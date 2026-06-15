import React, { useEffect, useRef, useState } from "react";
import {
  aiStatus,
  build,
  interview,
  type AiStatus,
  type ChatMessage,
} from "../api.js";

type Stage = "idea" | "interview" | "building" | "error";

/**
 * The front of the funnel: describe an idea, answer the adaptive interview
 * (Qwen), then the app is built (MiniMax) and we hand off to the workspace where
 * tap-to-edit takes over.
 */
export function Wizard({ onBuilt }: { onBuilt: (files: string[]) => void }) {
  const [stage, setStage] = useState<Stage>("idea");
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [idea, setIdea] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [spec, setSpec] = useState<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    aiStatus().then(setStatus);
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, busy]);

  const startInterview = async () => {
    if (!idea.trim()) return;
    const first: ChatMessage = { role: "user", content: idea.trim() };
    setMessages([first]);
    setStage("interview");
    await advance([first]);
  };

  const advance = async (history: ChatMessage[]) => {
    setBusy(true);
    setError("");
    try {
      const turn = await interview(history);
      const withReply: ChatMessage[] = [
        ...history,
        { role: "assistant", content: turn.reply },
      ];
      setMessages(withReply);
      if (turn.done) {
        setSpec(turn.spec ?? null);
        await runBuild(turn.spec, idea);
      }
    } catch (e: any) {
      setError(e.message);
      setStage("error");
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async () => {
    if (!input.trim() || busy) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setMessages(next);
    setInput("");
    await advance(next);
  };

  const runBuild = async (specArg: unknown, ideaArg: string) => {
    setStage("building");
    const res = await build(specArg ? { spec: specArg } : { idea: ideaArg });
    if (res.ok && res.files) {
      onBuilt(res.files);
    } else {
      setError(res.error ?? "Build failed");
      setStage("error");
    }
  };

  const notConfigured =
    status && (!status.interviewer || !status.builder);

  return (
    <div className="wizard">
      <div className="wizard-card">
        <div className="wizard-head">
          <span className="brand">⌘ Claude-Replit</span>
          <span className="tagline">Describe it. Answer a few questions. Tap to edit.</span>
        </div>

        {notConfigured && (
          <div className="warn">
            {!status?.interviewer && "Interviewer (Qwen) "}
            {!status?.interviewer && !status?.builder && "and "}
            {!status?.builder && "Builder (MiniMax) "}
            not configured — add keys to <code>apps/backend/.env</code>. You can
            still{" "}
            <button className="link" onClick={() => onBuilt([])}>
              open the starter app
            </button>
            .
          </div>
        )}

        {stage === "idea" && (
          <div className="stage">
            <label className="field">
              <span>What do you want to build?</span>
              <textarea
                rows={4}
                value={idea}
                placeholder="e.g. A habit tracker with a daily streak and a calm green theme"
                onChange={(e) => setIdea(e.target.value)}
              />
            </label>
            <button className="primary" onClick={startInterview} disabled={!idea.trim()}>
              Start interview →
            </button>
          </div>
        )}

        {(stage === "interview" || stage === "building") && (
          <div className="stage">
            <div className="chat" ref={scrollRef}>
              {messages.map((m, i) => (
                <div key={i} className={"msg " + m.role}>
                  {m.content}
                </div>
              ))}
              {busy && <div className="msg assistant typing">…</div>}
              {stage === "building" && (
                <div className="msg assistant">🛠️ Building your app…</div>
              )}
            </div>
            {stage === "interview" && (
              <div className="composer">
                <input
                  value={input}
                  placeholder="Type your answer…"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAnswer()}
                  disabled={busy}
                />
                <button className="primary" onClick={sendAnswer} disabled={busy}>
                  Send
                </button>
              </div>
            )}
          </div>
        )}

        {stage === "error" && (
          <div className="stage">
            <div className="warn">⚠ {error}</div>
            <div className="row">
              <button className="primary" onClick={() => runBuild(spec, idea)}>
                Retry build
              </button>
              <button className="ghost" onClick={() => setStage("idea")}>
                Start over
              </button>
              <button className="ghost" onClick={() => onBuilt([])}>
                Open starter app
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
