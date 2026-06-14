import { t, b, type ASTNode } from "./parse.js";

/**
 * Set a style property (e.g. color / backgroundColor) on a JSX element, editing
 * the *source of truth* wherever it lives:
 *   style={{ color: 'red' }}            inline object literal
 *   style={styles.title}                StyleSheet.create / object reference
 *   style={[styles.title, { ... }]}     array -> edits the inline override,
 *                                       else falls back to the first ref
 * When the element has no style prop at all, one is added inline.
 *
 * Throws with a friendly message when the target cannot be resolved (v1 does not
 * follow spreads or computed members).
 */
export function applyStyleEdit(
  ast: ASTNode,
  elementPath: any,
  key: string,
  value: string,
): void {
  const opening = elementPath.node.openingElement;
  const attrs: any[] = opening.attributes ?? [];
  const styleAttr = attrs.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === "style",
  );

  if (!styleAttr) {
    // No style prop yet: add an inline one.
    opening.attributes = [
      ...attrs,
      b.jsxAttribute(
        b.jsxIdentifier("style"),
        b.jsxExpressionContainer(
          b.objectExpression([
            b.objectProperty(b.identifier(key), b.stringLiteral(value)),
          ]),
        ),
      ),
    ];
    return;
  }

  const container = styleAttr.value;
  if (!container || container.type !== "JSXExpressionContainer") {
    throw new Error("Unsupported style prop (expected an expression).");
  }

  const target = resolveStyleObject(ast, container.expression);
  if (!target) {
    throw new Error(
      "Could not resolve the style object to edit (spreads / computed styles aren't supported yet).",
    );
  }
  setObjectProp(target, key, value);
}

/** Resolve a style expression down to the ObjectExpression we should mutate. */
function resolveStyleObject(ast: ASTNode, expr: any): any | null {
  if (!expr) return null;

  if (expr.type === "ObjectExpression") return expr;

  if (expr.type === "Identifier" || expr.type === "MemberExpression") {
    return resolveReference(ast, expr);
  }

  if (expr.type === "ArrayExpression") {
    // Prefer an inline override object (last one wins at runtime).
    const inline = [...expr.elements]
      .reverse()
      .find((e: any) => e && e.type === "ObjectExpression");
    if (inline) return inline;
    // Otherwise fall back to the first resolvable reference.
    for (const el of expr.elements) {
      if (!el) continue;
      const resolved = resolveStyleObject(ast, el);
      if (resolved) return resolved;
    }
  }

  return null;
}

/**
 * Follow `styles` / `styles.title` to the ObjectExpression that defines it,
 * whether it came from `StyleSheet.create({...})` or a plain object literal.
 */
function resolveReference(ast: ASTNode, expr: any): any | null {
  let baseName: string;
  let propName: string | null = null;

  if (expr.type === "Identifier") {
    baseName = expr.name;
  } else {
    // MemberExpression: styles.title  (only single, non-computed members in v1)
    if (expr.computed || expr.object.type !== "Identifier") return null;
    baseName = expr.object.name;
    propName =
      expr.property.type === "Identifier"
        ? expr.property.name
        : expr.property.value;
  }

  const root = findDeclaratorObject(ast, baseName);
  if (!root) return null;
  if (!propName) return root;

  const prop = findProp(root, propName);
  if (prop && prop.value.type === "ObjectExpression") return prop.value;
  return null;
}

/** Find `const <name> = StyleSheet.create({...})` or `const <name> = {...}`. */
function findDeclaratorObject(ast: ASTNode, name: string): any | null {
  let result: any = null;
  t.visit(ast, {
    visitVariableDeclarator(path) {
      const node = path.node;
      if (node.id.type === "Identifier" && node.id.name === name) {
        const init = node.init;
        if (init?.type === "ObjectExpression") {
          result = init;
        } else if (
          init?.type === "CallExpression" &&
          init.arguments[0]?.type === "ObjectExpression"
        ) {
          // StyleSheet.create({...})
          result = init.arguments[0];
        }
        return false;
      }
      this.traverse(path);
    },
  });
  return result;
}

function findProp(objExpr: any, name: string): any | null {
  return (
    (objExpr.properties ?? []).find(
      (p: any) =>
        (p.type === "ObjectProperty" || p.type === "Property") &&
        propKeyName(p) === name,
    ) ?? null
  );
}

function propKeyName(p: any): string | undefined {
  if (p.key?.type === "Identifier") return p.key.name;
  if (p.key?.type === "StringLiteral" || p.key?.type === "Literal")
    return String(p.key.value);
  return undefined;
}

/** Set/replace a string-valued property on an ObjectExpression. */
function setObjectProp(objExpr: any, key: string, value: string): void {
  const existing = findProp(objExpr, key);
  if (existing) {
    existing.value = b.stringLiteral(value);
    return;
  }
  objExpr.properties = [
    ...(objExpr.properties ?? []),
    b.objectProperty(b.identifier(key), b.stringLiteral(value)),
  ];
}
