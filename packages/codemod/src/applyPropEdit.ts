import { b } from "./parse.js";

/**
 * Set a string JSX prop on an element (e.g. label="Notifications").
 *
 * Premium iOS UI passes copy as props to kit components (<SettingsRow label=…/>,
 * <AppButton title=…/>), so tapping that text edits the prop in the screen rather
 * than a text node inside the component. Handles:
 *   label="old"            -> string-literal attribute
 *   label={"old"}          -> expression-container string
 *   (missing)              -> adds label="new"
 */
export function applyPropEdit(
  elementPath: any,
  propName: string,
  value: string,
): void {
  const opening = elementPath.node.openingElement;
  const attrs: any[] = opening.attributes ?? [];
  const attr = attrs.find(
    (a) => a.type === "JSXAttribute" && a.name?.name === propName,
  );

  if (!attr) {
    opening.attributes = [
      ...attrs,
      b.jsxAttribute(b.jsxIdentifier(propName), b.stringLiteral(value)),
    ];
    return;
  }

  const v = attr.value;
  if (!v || v.type === "StringLiteral" || v.type === "Literal") {
    attr.value = b.stringLiteral(value);
    return;
  }
  if (v.type === "JSXExpressionContainer") {
    const expr = v.expression;
    if (expr.type === "StringLiteral" || expr.type === "Literal") {
      expr.value = value;
      if (expr.extra) delete expr.extra;
      return;
    }
    // Dynamic expression (template literal, identifier, etc.): replace with a
    // plain string literal so the edit is visible and stays valid.
    attr.value = b.stringLiteral(value);
    return;
  }
  attr.value = b.stringLiteral(value);
}
