import React, { useEffect, useRef, useState } from "react";
import type {
  AppToIdeMessage,
  EditRequest,
  IdeToAppMessage,
  Selection,
} from "@cr/protocol";
import { BACKEND_WS } from "./config.js";
import {
  aiEdit,
  applyEdit,
  fetchFile,
  fetchTree,
  saveFile,
  fetchHistory,
  historyUndo,
  historyRedo,
  historyRestore,
  type FileNode,
  type HistoryView,
  type RestoreResult,
} from "./api.js";
import { FileTree } from "./components/FileTree.js";
import { EditorPane } from "./components/EditorPane.js";
import { PreviewPane } from "./components/PreviewPane.js";
import { InlineEditor } from "./components/InlineEditor.js";
import { HistoryPanel } from "./components/HistoryPanel.js";
import { Wizard } from "./components/Wizard.js";

export function App() {
  const [phase, setPhase] = useState<"wizard" | "workspace">("wizard");
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [status, setStatus] = useState<string>("");
  const [history, setHistory] = useState<HistoryView>({
    entries: [],
    cursor: -1,
  });

  const wsRef = useRef<WebSocket | null>(null);
  // Keep the latest active path / dirty flag for keyboard handlers & refreshes.
  const activePathRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  activePathRef.current = activePath;
  dirtyRef.current = dirty;

  const refreshHistory = () =>
    fetchHistory().then(setHistory).catch(() => {});

  // Load the file tree + history when entering the workspace.
  useEffect(() => {
    if (phase !== "workspace") return;
    fetchTree().then(setTree).catch((e) => setStatus(`Backend: ${e.message}`));
    refreshHistory();
  }, [phase]);

  // Connect to the hub's IDE channel.
  useEffect(() => {
    let closed = false;
    let retry: any;
    const connect = () => {
      const ws = new WebSocket(BACKEND_WS);
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        let msg: AppToIdeMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.type === "selection") setSelection(msg.selection);
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, []);

  const sendToApp = (msg: IdeToAppMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  // Tell the preview to enter/exit edit mode when toggled.
  useEffect(() => {
    sendToApp({ type: editMode ? "enter-edit-mode" : "exit-edit-mode" });
  }, [editMode]);

  const openFile = async (path: string) => {
    try {
      const c = await fetchFile(path);
      setActivePath(path);
      setContent(c);
      setDirty(false);
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  const save = async () => {
    if (!activePath) return;
    try {
      await saveFile(activePath, content);
      setDirty(false);
      setStatus(`Saved ${activePath}`);
    } catch (e: any) {
      setStatus(e.message);
    }
  };

  // Re-read the open file from disk (after a server-side write) unless the user
  // has unsaved local edits.
  const refreshOpenFile = async (changed?: string[]) => {
    const p = activePathRef.current;
    if (!p || dirtyRef.current) return;
    if (changed && !changed.includes(p)) return;
    try {
      setContent(await fetchFile(p));
    } catch {
      /* ignore */
    }
  };

  const onApply = async (req: EditRequest) => {
    const res = await applyEdit(req);
    if (!res.ok) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    setStatus(`Updated ${res.file} (${req.kind})`);
    await refreshOpenFile(res.file ? [res.file] : undefined);
    refreshHistory();
  };

  const onAiEdit = async (source: Selection["source"], instruction: string) => {
    setStatus("🛠️ AI is editing…");
    const res = await aiEdit(source, instruction);
    if (!res.ok) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    setStatus(`AI updated ${res.file}`);
    await refreshOpenFile(res.file ? [res.file] : undefined);
    refreshHistory();
  };

  // Apply the outcome of an undo / redo / revert: refresh the open file, the
  // timeline, and drop the now-stale selection (its line/col may have moved).
  const applyRestore = async (res: RestoreResult, verb: string) => {
    if (!res.ok) {
      setStatus(res.error ? `⚠ ${res.error}` : `Nothing to ${verb}`);
      return;
    }
    if (res.view) setHistory(res.view);
    else refreshHistory();
    await refreshOpenFile(res.files);
    setSelection(null);
    setStatus(`${verb} ✓`);
  };

  const doUndo = async () => applyRestore(await historyUndo(), "Undo");
  const doRedo = async () => applyRestore(await historyRedo(), "Redo");
  const doRestore = async (index: number) =>
    applyRestore(await historyRestore(index), "Reverted");

  // Keyboard: Ctrl/⌘+Z = undo, Ctrl/⌘+Shift+Z (or Ctrl+Y) = redo.
  useEffect(() => {
    if (phase !== "workspace") return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        doRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const handleBuilt = async (files: string[]) => {
    setPhase("workspace");
    const entry = files.find((f) => f.endsWith("App.tsx")) ?? "App.tsx";
    // Give the tree a moment to refresh, then open the entry file.
    openFile(entry);
    refreshHistory();
  };

  if (phase === "wizard") {
    return <Wizard onBuilt={handleBuilt} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⌘ Claude-Replit</span>
        <span className="tagline">tap-to-edit live preview</span>
        <div className="topbar-history">
          <button
            className="hbtn"
            disabled={history.cursor < 0}
            onClick={doUndo}
            title="Undo (Ctrl/⌘+Z)"
          >
            ↶ Undo
          </button>
          <button
            className="hbtn"
            disabled={history.cursor >= history.entries.length - 1}
            onClick={doRedo}
            title="Redo (Ctrl/⌘+Shift+Z)"
          >
            ↷ Redo
          </button>
        </div>
        <button className="newbtn" onClick={() => setPhase("wizard")}>
          + New app
        </button>
        {dirty && <span className="dirty">● unsaved</span>}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-title">Files</div>
          <FileTree nodes={tree} activePath={activePath} onOpen={openFile} />
          <HistoryPanel
            history={history}
            onUndo={doUndo}
            onRedo={doRedo}
            onRestore={doRestore}
          />
        </aside>

        <main className="main">
          <EditorPane
            path={activePath}
            value={content}
            onChange={(v) => {
              setContent(v);
              setDirty(true);
            }}
            onSave={save}
          />
        </main>

        <section className="right">
          <PreviewPane
            editMode={editMode}
            onToggleEditMode={() => setEditMode((m) => !m)}
          />
          <InlineEditor
            selection={selection}
            onApply={onApply}
            onAiEdit={onAiEdit}
            onClose={() => setSelection(null)}
            status={status}
          />
        </section>
      </div>
    </div>
  );
}
