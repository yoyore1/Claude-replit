import React, { useEffect, useRef, useState } from "react";
import type {
  AppToIdeMessage,
  EditRequest,
  IdeToAppMessage,
  Selection,
} from "@cr/protocol";
import type { Go } from "../App.js";
import { BACKEND_WS } from "../config.js";
import {
  aiEdit,
  applyEdit,
  fetchFile,
  fetchHistory,
  fetchTree,
  getMessages,
  getProject,
  historyRedo,
  historyRestore,
  historyUndo,
  saveFile,
  type FileNode,
  type HistoryView,
  type Project,
  type RestoreResult,
} from "../api.js";
import { useProjectSocket } from "../useProjectSocket.js";
import { PreviewPane } from "../components/PreviewPane.js";
import { InlineEditor } from "../components/InlineEditor.js";
import { HistoryPanel } from "../components/HistoryPanel.js";
import { EditorPane } from "../components/EditorPane.js";
import { FileTree } from "../components/FileTree.js";
import { QrCode } from "../components/QrCode.js";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  spec_ready: "Ready to build",
  building: "Building",
  running: "Live",
  sleeping: "Paused",
  error: "Needs attention",
};

export function Build({
  go,
  projectId,
  autostart,
}: {
  go: Go;
  projectId: string;
  autostart?: boolean;
}) {
  const s = useProjectSocket(projectId);
  const [project, setProject] = useState<Project | null>(null);
  const [tab, setTab] = useState<"build" | "brainstorm">("build");
  const [input, setInput] = useState("");
  const [editMode, setEditMode] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [history, setHistory] = useState<HistoryView>({ entries: [], cursor: -1 });

  // Code panel state.
  const [tree, setTree] = useState<FileNode[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const activePathRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  activePathRef.current = activePath;
  dirtyRef.current = dirty;

  const ideWsRef = useRef<WebSocket | null>(null);
  const startedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const refreshHistory = () => fetchHistory().then(setHistory).catch(() => {});

  useEffect(() => {
    getProject(projectId).then(setProject).catch(() => {});
    getMessages(projectId, "build")
      .then((m) =>
        s.seed("build", m.map((x) => ({ id: x.id, role: x.role, text: x.content }))),
      )
      .catch(() => {});
    getMessages(projectId, "brainstorm")
      .then((m) =>
        s.seed(
          "brainstorm",
          m.map((x) => ({ id: x.id, role: x.role, text: x.content })),
        ),
      )
      .catch(() => {});
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!autostart || !s.connected || startedRef.current) return;
    const st = s.projectStatus;
    if (st === "building" || st === "running") {
      startedRef.current = true;
      return;
    }
    startedRef.current = true;
    s.send({ type: "build.start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart, s.connected, s.projectStatus]);

  // The `/ide` plane carries tap selections from the running preview.
  useEffect(() => {
    let closed = false;
    let retry: any;
    const connect = () => {
      const ws = new WebSocket(BACKEND_WS);
      ideWsRef.current = ws;
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
      ideWsRef.current?.close();
    };
  }, []);

  const sendToApp = (msg: IdeToAppMessage) => {
    const ws = ideWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  useEffect(() => {
    sendToApp({ type: editMode ? "enter-edit-mode" : "exit-edit-mode" });
  }, [editMode]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo(0, chatScrollRef.current.scrollHeight);
  }, [s.build, s.brainstorm, s.buildLog]);

  /* ----------------------------- tap-to-edit ----------------------------- */

  const refreshOpenFile = async (changed?: string[]) => {
    const p = activePathRef.current;
    if (!p || dirtyRef.current) return;
    if (changed && !changed.includes(p)) return;
    try {
      setContent(await fetchFile(p));
    } catch { /* ignore */ }
  };

  const onApply = async (req: EditRequest) => {
    const res = await applyEdit(req);
    if (!res.ok) return setStatus(`⚠ ${res.error}`);
    setStatus(`Updated ${res.file}`);
    await refreshOpenFile(res.file ? [res.file] : undefined);
    refreshHistory();
  };

  const onAiEdit = async (source: Selection["source"], instruction: string) => {
    setStatus("AI is editing…");
    const res = await aiEdit(source, instruction);
    if (!res.ok) return setStatus(`⚠ ${res.error}`);
    setStatus(`AI updated ${res.file}`);
    await refreshOpenFile(res.file ? [res.file] : undefined);
    refreshHistory();
  };

  const applyRestore = async (res: RestoreResult, verb: string) => {
    if (!res.ok) return setStatus(res.error ? `⚠ ${res.error}` : `Nothing to ${verb}`);
    if (res.view) setHistory(res.view);
    else refreshHistory();
    await refreshOpenFile(res.files);
    setSelection(null);
    setStatus(`${verb} ✓`);
  };
  const doUndo = async () => applyRestore(await historyUndo(), "Undo");
  const doRedo = async () => applyRestore(await historyRedo(), "Redo");
  const doRestore = async (i: number) =>
    applyRestore(await historyRestore(i), "Reverted");

  // Code panel.
  const openFile = async (path: string) => {
    try {
      setContent(await fetchFile(path));
      setActivePath(path);
      setDirty(false);
    } catch (e: any) {
      setStatus(e.message);
    }
  };
  const saveCode = async () => {
    if (!activePath) return;
    await saveFile(activePath, content);
    setDirty(false);
    setStatus(`Saved ${activePath}`);
    refreshHistory();
  };
  const toggleCode = () => {
    const next = !showCode;
    setShowCode(next);
    if (next && tree.length === 0) {
      fetchTree().then(setTree).catch(() => {});
      openFile("App.tsx");
    }
  };

  /* ------------------------------- chat ---------------------------------- */

  function sendChat() {
    const text = input.trim();
    if (!text) return;
    const conversation = tab === "brainstorm" ? "brainstorm" : "build";
    s.appendLocal(conversation, text);
    s.send({ type: "chat.send", conversation, text });
    setInput("");
  }

  const st = s.projectStatus ?? project?.status ?? "draft";
  const building = st === "building";
  const preview = s.preview ?? project?.preview ?? null;
  const showPreview = !building && (st === "running" || st === "sleeping");
  const spec = s.spec ?? project?.spec ?? null;
  const appName = spec?.name ?? project?.spec?.name ?? project?.name ?? "Your app";

  // Progress ring circumference for r=28: 2π*28 ≈ 175.9
  const RING_C = 175.9;
  const bp = s.buildProgress ?? 0;

  return (
    <div className="screen build">
      {/* ── Top bar ── */}
      <header className="build-topbar">
        <button className="btn-ghost" onClick={() => go({ name: "apps" })}>
          My apps
        </button>
        <h1>{appName}</h1>
        <span className={`badge badge-${st}`}>
          {STATUS_LABEL[st] ?? st}
          {building && bp > 0 ? ` · ${bp}%` : ""}
        </span>
        <div className="grow" />
        <button className="hbtn" disabled={history.cursor < 0} onClick={doUndo}>
          ↶ Undo
        </button>
        <button
          className="hbtn"
          disabled={history.cursor >= history.entries.length - 1}
          onClick={doRedo}
        >
          ↷ Redo
        </button>
        <button className="btn-ghost" onClick={toggleCode}>
          {showCode ? "Hide code" : "‹ › Code"}
        </button>
      </header>

      <div className="build-layout">
        {/* ── Left: chat / activity ── */}
        <aside className="build-chat">
          <div className="seg">
            <button
              className={tab === "build" ? "on" : ""}
              onClick={() => setTab("build")}
            >
              Build
            </button>
            <button
              className={tab === "brainstorm" ? "on" : ""}
              onClick={() => setTab("brainstorm")}
            >
              Brainstorm
            </button>
          </div>

          <div className="chat" ref={chatScrollRef}>
            {tab === "build" && building ? (
              <>
                <div className="progress">
                  <div className="bar" style={{ width: `${bp}%` }} />
                </div>
                {s.buildLog.map((e) => (
                  <div key={e.id} className="act-line">
                    <span className="act-icon">›</span>
                    <span>{e.text}</span>
                  </div>
                ))}
                {s.buildLog.length === 0 && (
                  <p className="muted small">Your app is taking shape…</p>
                )}
              </>
            ) : (
              <>
                {(tab === "build" ? s.build : s.brainstorm).length === 0 && (
                  <p className="muted small">
                    {tab === "brainstorm"
                      ? "Ask about your app — what's missing, what to prioritize, ideas for v2. I already know your plan and what's built."
                      : "Ask for any change, in plain words. \"Make the buttons bigger.\" \"Add a dark mode.\" It happens in the phone on the right."}
                  </p>
                )}
                {(tab === "build" ? s.build : s.brainstorm).map((m) => (
                  <div key={m.id} className={`imsg ${m.role}`}>
                    {m.text}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="composer">
            <input
              value={input}
              placeholder={
                tab === "brainstorm"
                  ? "Ask anything about your app"
                  : building
                    ? "Still building, one moment"
                    : "Describe a change"
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              disabled={tab === "build" && building}
            />
            <button
              className="primary"
              onClick={sendChat}
              disabled={tab === "build" && building}
            >
              Send
            </button>
          </div>
        </aside>

        {/* ── Center: phone preview or code ── */}
        <main className="build-center">
          {/* Agent status line */}
          <div className={`agent-line${!building && st === "running" ? " done" : ""}`}>
            {building && <span className="spin" />}
            {building
              ? `Building your app… ${bp}%`
              : st === "running"
                ? "Your app is ready."
                : st === "sleeping"
                  ? "App is paused."
                  : "Tap the button below to start your build."}
          </div>

          {showCode ? (
            <div className="code-panel">
              <div className="code-side">
                <FileTree nodes={tree} activePath={activePath} onOpen={openFile} />
              </div>
              <div className="code-main">
                <EditorPane
                  path={activePath}
                  value={content}
                  onChange={(v) => {
                    setContent(v);
                    setDirty(true);
                  }}
                  onSave={saveCode}
                />
              </div>
            </div>
          ) : showPreview ? (
            <PreviewPane
              editMode={editMode}
              onToggleEditMode={() => setEditMode((m) => !m)}
            />
          ) : building ? (
            <div className="phone-empty-state">
              <div className="build-progress-ring" aria-hidden>
                <svg viewBox="0 0 64 64">
                  <circle className="build-progress-ring-bg" cx="32" cy="32" r="28" />
                  <circle
                    className="build-progress-ring-fill"
                    cx="32" cy="32" r="28"
                    strokeDasharray={`${(bp / 100) * RING_C} ${RING_C}`}
                  />
                </svg>
                <span className="build-progress-ring-pct">{bp}%</span>
              </div>
              <b>Your app is being born</b>
              <span className="small">it shows up right here as it takes shape</span>
            </div>
          ) : (
            <div className="phone-empty-state">
              <b>Your app will appear here</b>
              <button className="primary" onClick={() => s.send({ type: "build.start" })}>
                Build my app
              </button>
            </div>
          )}
        </main>

        {/* ── Right: side panels ── */}
        <aside className="build-right">
          <InlineEditor
            selection={selection}
            onApply={onApply}
            onAiEdit={onAiEdit}
            onClose={() => setSelection(null)}
            status={status}
          />

          {/* QR / On your phone */}
          <div className="side-panel">
            <div className="side-panel-head">
              <span className="side-panel-title">On your phone</span>
              {preview ? (
                <span className="side-panel-badge">Ready</span>
              ) : building ? (
                <span className="side-panel-badge">Starting…</span>
              ) : null}
            </div>

            <ol className="expo-steps">
              <li>
                <span className="expo-step-num">1</span>
                <span>
                  Get <b>Expo Go</b> free from the App Store or Google Play
                </span>
              </li>
              <li>
                <span className="expo-step-num">2</span>
                <span>
                  Open <b>Expo Go</b> and scan this code
                </span>
              </li>
              <li>
                <span className="expo-step-num">3</span>
                <span>Your app opens on your phone</span>
              </li>
            </ol>

            {preview ? (
              <div className="qr-box">
                <QrCode value={preview.expUrl || preview.webUrl} size={168} />
                {(preview.expUrl || preview.webUrl) && (
                  <>
                    <p className="muted small">
                      Or paste this link in Expo Go if scanning is tricky
                    </p>
                    <code className="exp-url">{preview.expUrl || preview.webUrl}</code>
                  </>
                )}
                <p className="muted small">
                  Phone must be on the same Wi-Fi as this computer.
                </p>
              </div>
            ) : (
              <p className="muted small side-panel-empty">
                {building
                  ? "Starting Metro for your phone… about 10–20 seconds, then the QR appears."
                  : "Your QR code shows up here once the build finishes and Metro is running."}
              </p>
            )}
          </div>

          {/* App plan */}
          {spec?.screens && spec.screens.length > 0 && (
            <div className="side-panel">
              <div className="side-panel-head">
                <span className="side-panel-title">App plan</span>
                <span className="side-panel-badge">{spec.screens.length} screens</span>
              </div>
              {spec.screens.map((sc: any) => (
                <div key={sc.name} className="plan-screen">
                  <b>{sc.name}</b>
                  {sc.purpose && <span>{sc.purpose}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Next steps checklist */}
          <div className="side-panel">
            <div className="side-panel-head">
              <span className="side-panel-title">Next steps</span>
            </div>
            <ul className="check-list">
              {[
                { label: "Tell us your idea", done: true },
                { label: "App plan created", done: !!spec },
                { label: "App built", done: st === "running" || st === "sleeping" },
                { label: "Try it on your phone", done: false },
                { label: "Ask for your first change", done: false },
              ].map((item) => (
                <li key={item.label}>
                  <span className={item.done ? "check-on" : "check-off"}>
                    {item.done ? "✓" : "·"}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <HistoryPanel
            history={history}
            onUndo={doUndo}
            onRedo={doRedo}
            onRestore={doRestore}
          />
        </aside>
      </div>
    </div>
  );
}
