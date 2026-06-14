import { b } from "./parse.js";

/**
 * Replace the visible text content of a JSX element.
 *
 * Handles the common shapes produced by hand-written RN code:
 *   <Text>Hello</Text>           -> edits the JSXText child
 *   <Text>{'Hello'}</Text>       -> edits the string-literal expression
 *   <Text></Text> / <Text/>      -> inserts a JSXText child
 * When the element also contains nested elements, only the first text run is
 * edited so surrounding structure is preserved.
 */
export function applyTextEdit(elementPath: any, newText: string): void {
  const el = elementPath.node;
  const children: any[] = el.children ?? [];

  // 1) First non-whitespace JSXText wins.
  const textChild = children.find(
    (c) => c.type === "JSXText" && c.value.trim().length > 0,
  );
  if (textChild) {
    textChild.value = newText;
    return;
  }

  // 2) A {'string'} expression container.
  const exprChild = children.find(
    (c) =>
      c.type === "JSXExpressionContainer" &&
      (c.expression.type === "StringLiteral" ||
        c.expression.type === "Literal"),
  );
  if (exprChild) {
    exprChild.expression.value = newText;
    if (exprChild.expression.extra) {
      // recast/babel cache the raw source; clear it so the new value prints.
      delete exprChild.expression.extra;
    }
    return;
  }

  // 3) Any (possibly whitespace-only) JSXText we can repurpose.
  const blankText = children.find((c) => c.type === "JSXText");
  if (blankText) {
    blankText.value = newText;
    return;
  }

  // 4) Nothing to edit: insert a fresh text child and make the tag non-self-closing.
  el.children = [b.jsxText(newText)];
  if (el.openingElement) el.openingElement.selfClosing = false;
  if (!el.closingElement && el.openingElement) {
    el.closingElement = b.jsxClosingElement(el.openingElement.name);
  }
}
