import React from "react";
import type { HistoryView } from "../api.js";

/**
 * The edit-history timeline. Shows every tap-to-edit change oldest→newest with
 * the current state highlighted; click any row to revert cleanly to that point
 * (entries past the cursor are "redo" steps). Undo/Redo act on the last change.
 */
export function HistoryPanel({
  history,
  onUndo,
  onRedo,
  onRestore,
}: {
  history: HistoryView;
  onUndo: () => void;
  onRedo: () => void;
  onRestore: (index: number) => void;
}) {
  const { entries, cursor } = history;
  const canUndo = cursor >= 0;
  const canRedo = cursor < entries.length - 1;
  const time = (ts: number) =>
    new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  return (
    <div className="history">
      <div className="history-head">
        <span className="history-title">History</span>
        <div className="history-actions">
          <button
            className="hbtn"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo (Ctrl/⌘+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="hbtn"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo (Ctrl/⌘+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      <ul className="history-list">
        <li className={"history-item base" + (cursor === -1 ? " current" : "")}>
          <button onClick={() => onRestore(-1)}>
            <span className="hi-label">Initial app</span>
            <span className="hi-meta">starting point</span>
          </button>
        </li>
        {entries.map((e, i) => (
          <li
            key={e.id}
            className={
              "history-item" +
              (i === cursor ? " current" : "") +
              (i > cursor ? " future" : "")
            }
          >
            <button onClick={() => onRestore(i)} title={`Revert to: ${e.label}`}>
              <span className="hi-label">{e.label}</span>
              <span className="hi-meta">{time(e.ts)}</span>
            </button>
          </li>
        ))}
      </ul>

      {entries.length === 0 && (
        <div className="history-empty">
          No edits yet — tap an element in the preview to start.
        </div>
      )}
    </div>
  );
}
