import React, { useEffect, useRef, useState } from "react";
import type { Go } from "../App.js";
import { ensureSpec, getMessages, getProject, isGuest } from "../api.js";
import { useProjectSocket } from "../useProjectSocket.js";

const APPABLE_PICK = "Let Appable pick";
const GO_DEEPER = "Let's go deeper";
const START_BUILDING = "Start building →";

// Short captions paired with each vibe so the swatch cards feel friendly.
const VIBE_META: Record<string, { caption: string; swatch: string[] }> = {
  "Calm & minimal": { caption: "clean, quiet, easy on the eyes", swatch: ["#f5f5f4", "#1c1917"] },
  "Bold & playful": { caption: "bright, fun, full of energy", swatch: ["#ff5a5f", "#ffd166"] },
  "Warm & cozy": { caption: "soft, friendly, inviting", swatch: ["#fbf9f5", "#c8431d"] },
  "Sleek & dark": { caption: "modern, sharp, premium", swatch: ["#0b0d10", "#6d5dfc"] },
};

export function Interview({
  go,
  projectId,
  idea,
}: {
  go: Go;
  projectId: string;
  idea?: string;
}) {
  const s = useProjectSocket(projectId);
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [waiting, setWaiting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [listening, setListening] = useState(false);
  const sentIdea = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<any>(null);

  // Load any prior interview history.
  useEffect(() => {
    getMessages(projectId, "interview")
      .then((msgs) => {
        s.seed(
          "interview",
          msgs.map((m) => ({ id: m.id, role: m.role, text: m.content })),
        );
        if (msgs.length) sentIdea.current = true;
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Kick off with the idea typed on Home.
  useEffect(() => {
    if (s.connected && idea && !sentIdea.current) {
      sentIdea.current = true;
      s.appendLocal("interview", idea);
      s.send({ type: "chat.send", conversation: "interview", text: idea });
      setWaiting(true);
    }
  }, [s.connected, idea]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop the typing spinner + clear picks when the assistant replies.
  useEffect(() => {
    const last = s.interview[s.interview.length - 1];
    if (last?.role === "assistant") {
      setWaiting(false);
      setPicked([]);
    }
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [s.interview]);

  async function continueFlow() {
    if (isGuest()) {
      go({ name: "signup", projectId });
      return;
    }
    const project = await getProject(projectId);
    go(project.paidAt ? { name: "overview", projectId } : { name: "pay", projectId });
  }

  async function startBuilding() {
    setAdvancing(true);
    try {
      await continueFlow();
    } catch {
      setAdvancing(false);
    }
  }

  // Persistent escape hatch: stop answering, force a sensible spec, move on.
  async function skipToBuild() {
    if (advancing) return;
    setAdvancing(true);
    try {
      await ensureSpec(projectId);
      await continueFlow();
    } catch {
      setAdvancing(false);
    }
  }

  function sendAnswer(text: string) {
    if (!text.trim()) return;
    s.appendLocal("interview", text);
    s.send({ type: "chat.send", conversation: "interview", text });
    setInput("");
    setPicked([]);
    setWaiting(true);
  }

  // Compose the answer from selected chips + any typed text, then send.
  function sendComposed() {
    const parts = [...picked];
    if (input.trim()) parts.push(input.trim());
    if (!parts.length) return;
    sendAnswer(parts.join(", "));
  }

  function togglePick(item: string) {
    setPicked((p) => (p.includes(item) ? p.filter((x) => x !== item) : [...p, item]));
  }

  // Optional voice input via the Web Speech API (graceful no-op if unsupported).
  const speechSupported =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  function toggleMic() {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = "en-US";
    recog.interimResults = false;
    recog.onresult = (e: any) => setInput(e.results[0][0].transcript);
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recog.start();
    setListening(true);
  }

  const sugg = s.interviewSuggestions;
  const isWrapup = sugg?.mode === "wrapup";
  const isVibe = sugg?.mode === "vibe";
  const total = sugg?.total ?? 3;
  const step = isWrapup ? total : sugg?.step ?? 1;
  const started = s.interview.length > 0;

  // Drop any model-supplied "pick for me" option — we always render our own red
  // "Let Appable pick" pill instead, so it's consistent on every question.
  const realItems = (sugg?.items ?? []).filter(
    (i) => !/you pick|appable pick|surprise|decide for me|pick for me|no preference|not sure/i.test(i),
  );

  return (
    <div className="screen interview">
      <nav className="nav">
        <span className="logo" onClick={() => go({ name: "home" })}>
          Appable
        </span>
        <span className="stepper">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={`step-dash${i < step ? " on" : ""}`} />
          ))}
          <span className="step">Getting to know your app</span>
        </span>
      </nav>

      <div className="chat-wrap">
        <div className="interview-head">
          <div className="eyebrow">{isWrapup ? "All set" : `Step ${step} of ${total}`}</div>
          <h2>Let's get to know your app.</h2>
          <p className="sub">A minute of friendly questions — then we build it.</p>
        </div>

        <div className="chat" ref={scrollRef}>
          {s.interview.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.text}
            </div>
          ))}
          {waiting && (
            <div className="typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          )}
        </div>

        {isWrapup && (
          <>
            <div className="spec-ready-card">
              <b>Your app plan is ready.</b>
              <span className="small">Here comes the fun part</span>
            </div>
            {s.spec && (
              <div className="recap">
                <div className="recap-name">{s.spec.name}</div>
                {s.spec.tagline && <div className="recap-tag">{s.spec.tagline}</div>}
                {Array.isArray(s.spec.features) && s.spec.features.length > 0 && (
                  <ul className="recap-list">
                    {s.spec.features.slice(0, 5).map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="suggest-wrapup">
              <div className="suggest-hint">Looks good?</div>
              <div className="suggest-row">
                <button className="primary" onClick={startBuilding} disabled={advancing}>
                  {advancing ? "On our way…" : START_BUILDING}
                </button>
                <button className="ghost" onClick={() => sendAnswer(GO_DEEPER)}>
                  {GO_DEEPER}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Vibe picker — single tap sends immediately */}
        {!isWrapup && isVibe && sugg && sugg.items.length > 0 && (
          <div className="suggest-block">
            <div className="suggest-hint">Tap the look you love</div>
            <div className="vibe-row">
              {sugg.items.map((item, i) => {
                const meta = VIBE_META[item];
                return (
                  <button
                    key={`${item}-${i}`}
                    className="vibe-card"
                    onClick={() => sendAnswer(item)}
                  >
                    <span className="vibe-swatch">
                      <span style={{ background: meta?.swatch[0] ?? "#f5f1ea" }} />
                      <span style={{ background: meta?.swatch[1] ?? "#1c1814" }} />
                    </span>
                    <b>{item}</b>
                    {meta?.caption && <span className="vibe-caption">{meta.caption}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Regular multi-select chips */}
        {!isWrapup && !isVibe && sugg && realItems.length > 0 && (
          <div className="suggest-block">
            <div className="suggest-hint">
              {picked.length
                ? `${picked.length} selected · tap send when ready`
                : "Pick any that fit — one, two, or all"}
            </div>
            <div className="suggest-row">
              {realItems.map((item, i) => (
                <button
                  key={`${item}-${i}`}
                  className={`chip${picked.includes(item) ? " selected" : ""}`}
                  onClick={() => togglePick(item)}
                >
                  {item}
                </button>
              ))}
              {/* Always the dedicated red "Let Appable pick" pill — Appable
                  chooses the single best option and moves on. */}
              <button className="chip ghost" onClick={() => sendAnswer(APPABLE_PICK)}>
                {APPABLE_PICK}
              </button>
            </div>
          </div>
        )}

        <div className="composer">
          {speechSupported && (
            <button
              className={`mic${listening ? " on" : ""}`}
              onClick={toggleMic}
              title="Speak"
              aria-label="Speak"
            >
              🎤
            </button>
          )}
          <input
            value={input}
            placeholder="Type your answer…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendComposed()}
          />
          <button className="primary" onClick={sendComposed}>
            Send
          </button>
        </div>

        {!isWrapup && started && (
          <button className="skip-build" onClick={skipToBuild} disabled={advancing}>
            {advancing ? "Getting it ready…" : "Skip the questions — just build it for me →"}
          </button>
        )}
      </div>
    </div>
  );
}
