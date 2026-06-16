import { t, type ASTNode } from "./parse.js";
import type { SourceLocation } from "@cr/protocol";

/**
 * Find the JSXElement whose opening tag starts at the given (line, col).
 *
 * The babel-plugin-tapsource captures the JSXOpeningElement's start position
 * (1-based line, 0-based column from @babel/parser), so we match against the
 * same coordinate.
 *
 * Tier 1 is an exact (line, col) hit. But a selection can go slightly stale when
 * a PRIOR edit reflowed the file (recast re-prints; line numbers shift) before
 * the live preview re-tagged `__tapSource` — so a quick follow-up edit arrives
 * with pre-edit line numbers. Tier 2 recovers from that drift: it re-finds the
 * element by signals that DON'T change when other elements move lines around —
 * the start column, the end column, and the line-span (endLine - startLine) — and
 * picks the one nearest the requested line. If that's ambiguous (a tie) or wildly
 * far, we still return null so the caller reports "re-tap" rather than risk
 * editing the wrong element.
 *
 * Returns the recast/ast-types NodePath, or null when nothing matches.
 */
export function locateJsxElement(
  ast: ASTNode,
  source: Pick<SourceLocation, "line" | "col"> & {
    end?: { line: number; col: number };
  },
): any | null {
  type Cand = {
    path: any;
    sLine: number;
    sCol: number;
    eLine: number;
    eCol: number;
  };
  const all: Cand[] = [];
  let exact: any = null;

  t.visit(ast, {
    visitJSXElement(path) {
      const loc = path.node.openingElement.loc;
      if (loc) {
        if (
          exact === null &&
          loc.start.line === source.line &&
          loc.start.column === source.col
        ) {
          exact = path;
        }
        const end = path.node.loc?.end ?? loc.end;
        all.push({
          path,
          sLine: loc.start.line,
          sCol: loc.start.column,
          eLine: end?.line ?? loc.start.line,
          eCol: end?.column ?? loc.start.column,
        });
      }
      this.traverse(path);
    },
  });

  if (exact) return exact;

  // Tier 2: tolerate line drift. Require the same start column (indentation is
  // stable across content edits) plus, when we know it, the same end column and
  // line-span — a signature that survives other elements shifting lines but is
  // specific enough to pin the right element.
  const span = source.end ? source.end.line - source.line : null;
  const candidates = all.filter((c) => {
    if (c.sCol !== source.col) return false;
    if (source.end) {
      if (c.eCol !== source.end.col) return false;
      if (span !== null && c.eLine - c.sLine !== span) return false;
    }
    return true;
  });
  if (candidates.length === 0) return null;

  candidates.sort(
    (a, b) =>
      Math.abs(a.sLine - source.line) - Math.abs(b.sLine - source.line),
  );
  const best = candidates[0];
  const bestDist = Math.abs(best.sLine - source.line);
  // Too far to be a confident drift recovery.
  if (bestDist > 80) return null;
  // Ambiguous: two equally-near candidates with the same signature — don't guess.
  if (
    candidates.length > 1 &&
    Math.abs(candidates[1].sLine - source.line) === bestDist
  ) {
    return null;
  }
  return best.path;
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
