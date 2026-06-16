import { b } from "./parse.js";
import { ensureInlineOverride } from "./applyStyleEdit.js";

/**
 * Free-drag: nudge ONE thing by a pixel delta using a `transform` translate,
 * scoped via the same inline-style override we use for color/bg (so it stacks):
 *   style={styles.card}  ->  style={[styles.card, { transform: [{ translateX: 12 }, { translateY: 8 }] }]}
 *
 * We use translate (NOT position:"absolute") on purpose: the element keeps its
 * place in the layout, so its SIBLINGS don't reflow when it moves — dragging the
 * meal name doesn't shove "Breakfast" up into its slot. The element just shifts
 * visually wherever it's dropped. Deltas accumulate, so repeated drags add up.
 *
 * `styleAttr` decides WHAT moves, exactly like color does:
 *  - "style"        — the element/container itself (a View's box; children come along).
 *  - "<field>Style" — a single text PROP of a kit component (e.g. "labelStyle"),
 *                     so dragging a row's label moves ONLY that text, not the row.
 */
export function applyMoveEdit(
  elementPath: any,
  styleAttr: string,
  delta: { dx: number; dy: number },
): void {
  const opening = elementPath.node.openingElement;
  const override = ensureInlineOverride(opening, styleAttr);
  const arr = ensureTransformArray(override);
  bumpAxis(arr, "translateX", Math.round(delta.dx));
  bumpAxis(arr, "translateY", Math.round(delta.dy));
}

/** Get (creating if needed) the `transform` array on the inline override. */
function ensureTransformArray(objExpr: any): any {
  const props = objExpr.properties ?? [];
  const existing = props.find(
    (p: any) =>
      (p.type === "ObjectProperty" || p.type === "Property") &&
      keyName(p) === "transform",
  );
  if (existing) {
    if (existing.value?.type === "ArrayExpression") return existing.value;
    // Unexpected shape (a ref/spread) — replace with a fresh array we control.
    existing.value = b.arrayExpression([]);
    return existing.value;
  }
  const arr = b.arrayExpression([]);
  objExpr.properties = [
    ...props,
    b.objectProperty(b.identifier("transform"), arr),
  ];
  return arr;
}

/** Add `delta` to the {translateX|translateY: n} entry, creating it if absent. */
function bumpAxis(arrExpr: any, axis: string, delta: number): void {
  for (const el of arrExpr.elements ?? []) {
    if (el && el.type === "ObjectExpression") {
      const prop = (el.properties ?? []).find((p: any) => keyName(p) === axis);
      if (prop) {
        prop.value = numLit(readNum(prop.value) + delta);
        if (prop.value.extra) delete prop.value.extra;
        return;
      }
    }
  }
  arrExpr.elements.push(
    b.objectExpression([b.objectProperty(b.identifier(axis), numLit(delta))]),
  );
}

/** Read a numeric value from a literal or a unary-minus node (0 if unknown). */
function readNum(node: any): number {
  if (!node) return 0;
  if (node.type === "NumericLiteral" || node.type === "Literal") {
    return Number(node.value) || 0;
  }
  if (node.type === "UnaryExpression" && node.operator === "-") {
    return -readNum(node.argument);
  }
  return 0;
}

/** Numeric literal that also handles negatives (a unary minus node). */
function numLit(n: number): any {
  const r = Math.round(n);
  return r < 0
    ? b.unaryExpression("-", b.numericLiteral(Math.abs(r)), true)
    : b.numericLiteral(r);
}

function keyName(p: any): string | undefined {
  if (p.key?.type === "Identifier") return p.key.name;
  if (p.key?.type === "StringLiteral" || p.key?.type === "Literal")
    return String(p.key.value);
  return undefined;
}
