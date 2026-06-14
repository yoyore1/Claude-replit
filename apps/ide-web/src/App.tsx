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
  type FileNode,
} from "./api.js";
import { FileTree } from "./components/FileTree.js";
import { EditorPane } from "./components/EditorPane.js";
import { PreviewPane } from "./components/PreviewPane.js";
import { InlineEditor } from "./components/InlineEditor.js";
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

  const wsRef = useRef<WebSocket | null>(null);

  // Load the file tree when entering the workspace.
  useEffect(() => {
    if (phase !== "workspace") return;
    fetchTree().then(setTree).catch((e) => setStatus(`Backend: ${e.message}`));
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

  const onApply = async (req: EditRequest) => {
    const res = await applyEdit(req);
    if (!res.ok) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    setStatus(`Updated ${res.file} (${req.kind})`);
    // If the edited file is open, refresh its contents in the editor.
    if (res.file && res.file === activePath && !dirty) {
      try {
        setContent(await fetchFile(res.file));
      } catch {
        /* ignore */
      }
    }
  };

  const onAiEdit = async (source: Selection["source"], instruction: string) => {
    setStatus("🛠️ AI is editing…");
    const res = await aiEdit(source, instruction);
    if (!res.ok) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    setStatus(`AI updated ${res.file}`);
    if (res.file && res.file === activePath && !dirty) {
      try {
        setContent(await fetchFile(res.file));
      } catch {
        /* ignore */
      }
    }
  };

  const handleBuilt = async (files: string[]) => {
    setPhase("workspace");
    const entry = files.find((f) => f.endsWith("App.tsx")) ?? "App.tsx";
    // Give the tree a moment to refresh, then open the entry file.
    openFile(entry);
  };

  if (phase === "wizard") {
    return <Wizard onBuilt={handleBuilt} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">⌘ Claude-Replit</span>
        <span className="tagline">tap-to-edit live preview</span>
        <button className="newbtn" onClick={() => setPhase("wizard")}>
          + New app
        </button>
        {dirty && <span className="dirty">● unsaved</span>}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-title">Files</div>
          <FileTree nodes={tree} activePath={activePath} onOpen={openFile} />
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
