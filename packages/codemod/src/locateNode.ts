import { t, type ASTNode } from "./parse.js";
import type { SourceLocation } from "@cr/protocol";

/**
 * Find the JSXElement whose opening tag starts at the given (line, col).
 *
 * The babel-plugin-tapsource captures the JSXOpeningElement's start position
 * (1-based line, 0-based column from @babel/parser), so we match against the
 * same coordinate. Returns the recast/ast-types NodePath, or null when nothing
 * matches (e.g. the file changed under us — caller should report "re-tap").
 */
export function locateJsxElement(
  ast: ASTNode,
  source: Pick<SourceLocation, "line" | "col">,
): any | null {
  let found: any = null;

  t.visit(ast, {
    visitJSXElement(path) {
      const opening = path.node.openingElement;
      const loc = opening.loc;
      if (
        loc &&
        loc.start.line === source.line &&
        loc.start.column === source.col
      ) {
        found = path;
        return false; // stop traversal
      }
      this.traverse(path);
    },
  });

  return found;
}

/** Human name of a JSX element ("Text", "View", "Custom.Component"). */
export function jsxName(node: any): string {
  const name = node.openingElement?.name ?? node.name;
  if (!name) return "?";
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    return `${jsxNamePart(name.object)}.${name.property.name}`;
  }
  return "?";
}

function jsxNamePart(n: any): string {
  if (n.type === "JSXIdentifier") return n.name;
  if (n.type === "JSXMemberExpression")
    return `${jsxNamePart(n.object)}.${n.property.name}`;
  return "?";
}
