import { writeFile } from "./fileApi.js";

/**
 * Edit history for tap-to-edit.
 *
 * Every successful source edit (deterministic codemod OR AI edit) records a
 * snapshot of the file's content before and after. That gives us a clean,
 * linear timeline the IDE can walk: undo / redo, and "revert to here" to jump
 * straight to any past state.
 *
 * The timeline is the source of truth for *content*; restoring an entry just
 * writes the right snapshot back to disk, and the bundler's watcher hot-reloads
 * the preview — exactly like a normal edit, so Fast Refresh never breaks.
 *
 * `cursor` is the index of the last *applied* entry. cursor === -1 means the
 * "initial" state (before the first recorded edit, i.e. the freshly built app).
 */

export interface HistoryEntry {
  id: string;
  ts: number;
  /** Human-readable summary, e.g. "Text · App.tsx" or "Color (label) · App.tsx". */
  label: string;
  /** Repo-relative file this edit changed. */
  file: string;
  /** File content before / after this edit. */
  before: string;
  after: string;
}

/** What the IDE needs to render the timeline (snapshots stripped). */
export interface HistoryView {
  entries: { id: string; ts: number; label: string; file: string }[];
  /** Index of the currently-applied entry; -1 = initial state. */
  cursor: number;
}

let entries: HistoryEntry[] = [];
let cursor = -1;
let seq = 0;

/** Clear the timeline — called when a brand-new app is built. */
export function reset(): void {
  entries = [];
  cursor = -1;
}

/**
 * Record a just-applied edit. If we're not at the tip of the timeline (the user
 * undid and then made a fresh edit), the now-orphaned "redo" tail is dropped.
 */
export function record(input: {
  file: string;
  before: string;
  after: string;
  label: string;
}): void {
  if (input.before === input.after) return; // no-op, nothing to record
  if (cursor < entries.length - 1) {
    entries = entries.slice(0, cursor + 1); // drop the redo tail
  }
  entries.push({
    id: `e${++seq}`,
    ts: Date.now(),
    label: input.label,
    file: input.file,
    before: input.before,
    after: input.after,
  });
  cursor = entries.length - 1;
}

/** The metadata view for the IDE. */
export function view(): HistoryView {
  return {
    entries: entries.map((e) => ({
      id: e.id,
      ts: e.ts,
      label: e.label,
      file: e.file,
    })),
    cursor,
  };
}

/** Distinct files that appear anywhere in the timeline. */
function trackedFiles(): string[] {
  return [...new Set(entries.map((e) => e.file))];
}

/**
 * Content of `file` as of timeline index `k` (after applying entries[0..k]).
 * Returns null if this file never appears in the timeline.
 */
function fileStateAt(file: string, k: number): string | null {
  let firstBefore: string | null = null;
  let lastAfter: string | null = null;
  for (let j = 0; j < entries.length; j++) {
    const e = entries[j];
    if (e.file !== file) continue;
    if (firstBefore === null) firstBefore = e.before;
    if (j <= k) lastAfter = e.after;
  }
  return lastAfter ?? firstBefore;
}

export interface RestoreResult {
  ok: boolean;
  error?: string;
  /** Files written by the restore (for the IDE to refresh). */
  files: string[];
  cursor: number;
}

/**
 * Move the timeline to index `target` (-1..entries.length-1) and write every
 * tracked file to its content at that point. Used by undo / redo / revert-here.
 */
export async function restoreTo(target: number): Promise<RestoreResult> {
  const max = entries.length - 1;
  if (target < -1 || target > max) {
    return { ok: false, error: "history index out of range", files: [], cursor };
  }
  const written: string[] = [];
  for (const file of trackedFiles()) {
    const content = fileStateAt(file, target);
    if (content == null) continue;
    try {
      await writeFile(file, content);
      written.push(file);
    } catch (e: any) {
      return { ok: false, error: `Cannot restore ${file}: ${e.message}`, files: written, cursor };
    }
  }
  cursor = target;
  return { ok: true, files: written, cursor };
}

export async function undo(): Promise<RestoreResult> {
  if (cursor < 0) {
    return { ok: false, error: "nothing to undo", files: [], cursor };
  }
  return restoreTo(cursor - 1);
}

export async function redo(): Promise<RestoreResult> {
  if (cursor >= entries.length - 1) {
    return { ok: false, error: "nothing to redo", files: [], cursor };
  }
  return restoreTo(cursor + 1);
}
