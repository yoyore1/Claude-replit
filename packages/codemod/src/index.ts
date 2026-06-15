import { parse, print } from "./parse.js";
import { locateJsxElement } from "./locateNode.js";
import { applyTextEdit } from "./applyTextEdit.js";
import { applyStyleEdit } from "./applyStyleEdit.js";
import { applyPropEdit } from "./applyPropEdit.js";
import type { EditRequest } from "@cr/protocol";

export { locateJsxElement, jsxName } from "./locateNode.js";
export { applyTextEdit } from "./applyTextEdit.js";
export { applyStyleEdit } from "./applyStyleEdit.js";
export { applyPropEdit } from "./applyPropEdit.js";
export { parse, print } from "./parse.js";

export interface ApplyEditOutcome {
  ok: boolean;
  code?: string;
  error?: string;
}

/**
 * Apply a single tap-to-edit change to a source file's text and return the new
 * text. Safe by construction:
 *  - locates the node by exact (line,col); a miss means the file moved under us,
 *    so we return a "re-tap" error rather than editing the wrong place;
 *  - re-parses the output before returning so we never hand Metro broken code
 *    (which would break Fast Refresh).
 */
export function applyEdit(code: string, req: EditRequest): ApplyEditOutcome {
  let ast;
  try {
    ast = parse(code);
  } catch (e: any) {
    return { ok: false, error: `Could not parse source: ${e.message}` };
  }

  const path = locateJsxElement(ast, req.source);
  if (!path) {
    return {
      ok: false,
      error: "stale selection — re-tap the element and try again",
    };
  }

  try {
    if (req.kind === "text") {
      applyTextEdit(path, req.value);
    } else if (req.kind === "prop") {
      if (!req.prop) return { ok: false, error: "prop name required" };
      applyPropEdit(path, req.prop, req.value);
    } else {
      // "color" | "fontFamily" | "fontWeight" | "backgroundColor" — element-
      // scoped style override. The text-affecting edits on a kit component whose
      // text comes from a prop (field set) are scoped to a per-field style attr
      // (`${field}Style`) so a row's label and value style independently;
      // backgroundColor always targets the element's own `style` (the box).
      const textStyle =
        req.kind === "color" ||
        req.kind === "fontFamily" ||
        req.kind === "fontWeight";
      const styleAttr =
        textStyle && req.field ? `${req.field}Style` : "style";
      applyStyleEdit(path, styleAttr, req.kind, req.value);
    }
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  let out: string;
  try {
    out = print(ast);
  } catch (e: any) {
    return { ok: false, error: `Failed to print edited source: ${e.message}` };
  }

  // Guard: never write code that won't re-parse.
  try {
    parse(out);
  } catch (e: any) {
    return { ok: false, error: `Edit produced invalid source: ${e.message}` };
  }

  return { ok: true, code: out };
}
