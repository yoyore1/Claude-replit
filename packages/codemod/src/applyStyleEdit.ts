import { b } from "./parse.js";

/**
 * Set a style property (color / backgroundColor) on a JSX element, scoped to
 * THIS element only ("override this element").
 *
 * We never edit a shared StyleSheet entry or a token, because that would change
 * every element using it. Instead we ensure the element has an inline style
 * override object and set the key there:
 *   style={styles.title}            -> style={[styles.title, { color: "#.." }]}
 *   style={{ color: tokens.x }}      -> style={{ color: "#.." }}
 *   style={[a, { ... }]}             -> edits the trailing inline object
 *   (no style)                       -> style={{ color: "#.." }}
 *
 * `styleAttr` is the JSX attribute to write to — usually "style", but a kit
 * component's per-field text color targets e.g. "labelStyle" / "valueStyle" so
 * sibling texts on the same element recolor independently.
 */
export function applyStyleEdit(
  elementPath: any,
  styleAttr: string,
  key: string,
  value: string,
): void {
  const opening = elementPath.node.openingElement;
  const override = ensureInlineOverride(opening, styleAttr);
  setObjectProp(override, key, value);
}

/** Return (creating if needed) an inline ObjectExpression we can write keys to. */
function ensureInlineOverride(opening: any, attrName: string): any {
  const attrs: any[] = opening.attributes ?? [];
  const styleAttr = attrs.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === attrName,
  );

  if (!styleAttr) {
    const obj = b.objectExpression([]);
    opening.attributes = [
      ...attrs,
      b.jsxAttribute(b.jsxIdentifier(attrName), b.jsxExpressionContainer(obj)),
    ];
    return obj;
  }

  const container = styleAttr.value;
  if (!container || container.type !== "JSXExpressionContainer") {
    // style="something" (unusual) — replace with an inline object.
    const obj = b.objectExpression([]);
    styleAttr.value = b.jsxExpressionContainer(obj);
    return obj;
  }

  const expr = container.expression;

  if (expr.type === "ObjectExpression") return expr;

  if (expr.type === "ArrayExpression") {
    const lastInline = [...expr.elements]
      .reverse()
      .find((e: any) => e && e.type === "ObjectExpression");
    if (lastInline) return lastInline;
    const obj = b.objectExpression([]);
    expr.elements.push(obj);
    return obj;
  }

  // Reference / token / PlatformColor(...) / call etc: keep it and append an
  // inline override so the change is element-scoped.
  const obj = b.objectExpression([]);
  container.expression = b.arrayExpression([expr, obj]);
  return obj;
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
    if (existing.value.extra) delete existing.value.extra;
    return;
  }
  objExpr.properties = [
    ...(objExpr.properties ?? []),
    b.objectProperty(b.identifier(key), b.stringLiteral(value)),
  ];
}
