import { applyEdit } from "@cr/codemod";
import type { EditRequest, EditResult } from "@cr/protocol";
import { readFile, writeFile } from "./fileApi.js";
import { record } from "./history.js";

/** A short human label for the history timeline. */
function editLabel(req: EditRequest): string {
  const where = req.source.file;
  switch (req.kind) {
    case "text":
      return `Text · ${where}`;
    case "prop":
      return `Set ${req.prop ?? "prop"} · ${where}`;
    case "backgroundColor":
      return `Background · ${where}`;
    case "color":
      return `Color${req.field ? ` (${req.field})` : ""} · ${where}`;
    default:
      return `Edit · ${where}`;
  }
}

/**
 * Apply a tap-to-edit change to a source file on disk. The codemod guarantees
 * the result is valid, re-parseable code, so writing it never breaks Metro Fast
 * Refresh. Metro's own file watcher picks up the change and hot-reloads.
 */
export async function applySourceEdit(req: EditRequest): Promise<EditResult> {
  let original: string;
  try {
    original = await readFile(req.source.file);
  } catch (e: any) {
    return { ok: false, error: `Cannot read ${req.source.file}: ${e.message}` };
  }

  const outcome = applyEdit(original, req);
  if (!outcome.ok || outcome.code == null) {
    return { ok: false, error: outcome.error ?? "edit failed" };
  }

  // Avoid a needless write (and refresh) when nothing changed.
  if (outcome.code === original) {
    return { ok: true, file: req.source.file };
  }

  try {
    await writeFile(req.source.file, outcome.code);
  } catch (e: any) {
    return { ok: false, error: `Cannot write ${req.source.file}: ${e.message}` };
  }

  // Snapshot for the undo/redo timeline.
  record({
    file: req.source.file,
    before: original,
    after: outcome.code,
    label: editLabel(req),
  });

  return { ok: true, file: req.source.file };
}
