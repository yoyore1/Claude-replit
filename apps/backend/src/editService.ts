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
    case "move":
      return `Moved · ${where}`;
    default:
      return `Edit · ${where}`;
  }
}

/**
 * Serialize edits per file. Rapid edits (e.g. dragging several elements quickly)
 * would otherwise read-modify-write the same file concurrently: both read the
 * same original and the second write clobbers the first (a lost update), leaving
 * the preview inconsistent and the next selection stale. Chaining per path makes
 * each edit read the result of the previous one.
 */
const fileChains = new Map<string, Promise<unknown>>();

export function applySourceEdit(req: EditRequest): Promise<EditResult> {
  const key = req.source.file;
  const prev = fileChains.get(key) ?? Promise.resolve();
  const run = prev.then(
    () => applySourceEditInner(req),
    () => applySourceEditInner(req), // a prior failure shouldn't block the next
  );
  // Keep the chain alive but don't let it retain results/throw unhandled.
  fileChains.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

/**
 * Apply a tap-to-edit change to a source file on disk. The codemod guarantees
 * the result is valid, re-parseable code, so writing it never breaks Metro Fast
 * Refresh. Metro's own file watcher picks up the change and hot-reloads.
 */
async function applySourceEditInner(req: EditRequest): Promise<EditResult> {
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
