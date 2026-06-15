import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path of the user project the IDE edits (the Expo template app).
 * Override with PROJECT_ROOT to point the IDE at a different workspace.
 */
export const PROJECT_ROOT =
  process.env.PROJECT_ROOT ||
  path.resolve(__dirname, "../../template-app");

/** Resolve a repo-relative path safely, rejecting traversal outside the root. */
export function resolveInProject(relPath: string): string {
  const clean = relPath.replace(/^[/\\]+/, "");
  const abs = path.resolve(PROJECT_ROOT, clean);
  const root = path.resolve(PROJECT_ROOT);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path escapes project root: ${relPath}`);
  }
  return abs;
}

export function toRel(abs: string): string {
  return path.relative(PROJECT_ROOT, abs).split(path.sep).join("/");
}
