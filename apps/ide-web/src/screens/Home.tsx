import React, { useEffect, useState } from "react";
import type { Go } from "../App.js";
import { createProject, ensureSession, getToken } from "../api.js";
import {
  fetchInitialSuggestions,
  IdeaSuggestionsPanel,
  type ViewSet,
} from "../components/IdeaSuggestions.js";

const IDEA_POOL = [
  "A habit tracker that turns daily wins into streaks",
  "A booking app for local dog-walkers and their clients",
  "A meal planner that builds everyone's grocery list",
  "A budgeting app that makes saving feel like a game",
  "A workout log friends can share and compete in",
  "A plant-care reminder so no one's plants die",
  "A daily journal that checks in on how people feel",
  "A chore chart families actually stick to",
  "A simple storefront for a small online shop",
  "A recipe box communities can add to and share",
  "A flash-card app for students cramming for exams",
  "A packing-list app for travelers and trips",
  "A bill-splitter for roommates and friends",
  "A countdown app for events people can't wait for",
  "A feed-and-nap tracker for new parents",
  "A reading list app for book lovers",
  "A language app for a few minutes of daily practice",
  "An invoicing app for freelancers and side hustles",
];

function pickThree(except: string[] = []): string[] {
  const pool = IDEA_POOL.filter((i) => !except.includes(i));
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

// Rotating prompt shown inside the empty idea box: half are concrete app ideas,
// half are encouraging/half-formed nudges that hint "just start — Suggest ideas
// has you covered."
const PLACEHOLDERS = [
  "An app that plans dinners for busy families",
  "Even half an idea works — we'll shape it",
  "A workout app friends can do together",
  "Just say it, however it comes out…",
  "A booking app for a local business",
  "Not sure yet? Tap 💡 Suggest ideas",
  "A habit tracker people stick with",
  'Say "gym", "recipes", "budget"… we\'ve got you',
  "A bill-splitter for roommates and friends",
  "Stuck for words? We'll fill in the rest",
];

export function Home({ go }: { go: Go }) {
  const [idea, setIdea] = useState("");
  const [chips, setChips] = useState<string[]>(() => pickThree());
  const [chipsIn, setChipsIn] = useState(true);
  const [typed, setTyped] = useState("");
  const [starting, setStarting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stack, setStack] = useState<ViewSet[]>([]);
  const [stackIndex, setStackIndex] = useState(0);

  // Rotate the starter ideas on a loop: fade the current set out, swap in three
  // fresh ones (never repeating the visible trio), then fade back in.
  useEffect(() => {
    let swapT: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setChipsIn(false); // fade out
      swapT = setTimeout(() => {
        setChips((prev) => pickThree(prev));
        setChipsIn(true); // fade new ones in
      }, 420); // match the CSS opacity transition
    }, 3200);
    return () => {
      clearInterval(t);
      clearTimeout(swapT);
    };
  }, []);

  // Type the idea-box prompt out like a person, pause, delete, then the next one
  // — only while the box is empty. Small timing jitter makes it feel human.
  useEffect(() => {
    if (idea) {
      setTyped("");
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let idx = 0; // which phrase
    let pos = 0; // chars shown
    let mode: "type" | "pause" | "delete" = "type";
    const tick = () => {
      if (cancelled) return;
      const phrase = PLACEHOLDERS[idx];
      if (mode === "type") {
        pos++;
        setTyped(phrase.slice(0, pos));
        if (pos >= phrase.length) {
          mode = "pause";
          timer = setTimeout(tick, 1800);
        } else {
          timer = setTimeout(tick, 45 + Math.random() * 55);
        }
      } else if (mode === "pause") {
        mode = "delete";
        timer = setTimeout(tick, 40);
      } else {
        pos--;
        setTyped(phrase.slice(0, Math.max(0, pos)));
        if (pos <= 0) {
          idx = (idx + 1) % PLACEHOLDERS.length;
          mode = "type";
          timer = setTimeout(tick, 400);
        } else {
          timer = setTimeout(tick, 22);
        }
      }
    };
    timer = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idea]);

  async function start() {
    const text = idea.trim();
    if (!text || starting) return;
    setStarting(true);
    setError(null);
    try {
      await ensureSession();
      const project = await createProject("New app");
      go({ name: "interview", projectId: project.id, idea: text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStarting(false);
    }
  }

  async function suggest() {
    if (suggesting) return;
    setSuggesting(true);
    setError(null);
    try {
      const set = await fetchInitialSuggestions(idea);
      setStack([set]);
      setStackIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suggest ideas");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="screen home">
      <nav className="nav">
        <span className="logo">Appable</span>
        {getToken() && (
          <button className="ghost sm" onClick={() => go({ name: "apps" })}>
            My apps
          </button>
        )}
      </nav>

      <div className="home-top">
      <div className="hero">
        <h1>
          Make the app you've always wanted. <em>No code.</em>
        </h1>
        <p className="sub">
          Say your idea in plain words. Watch it become a real app on your phone
          — usually in about ten minutes.
        </p>

        <div className="idea-input-wrap">
          {!idea && (
            <div className="idea-ph" aria-hidden>
              {typed}
              <span className="idea-caret" />
            </div>
          )}
          <textarea
            className="idea-input"
            placeholder=""
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                start();
              }
            }}
          />
        </div>

        <div className="row center">
          <button className="ghost" onClick={suggest} disabled={suggesting}>
            {suggesting ? "Thinking…" : "💡 Suggest ideas"}
          </button>
          <button
            className="primary"
            onClick={start}
            disabled={!idea.trim() || starting}
          >
            {starting ? "One moment…" : "Let's build it →"}
          </button>
        </div>

        {error && <div className="warn">{error}</div>}

        {stack.length > 0 && (
          <IdeaSuggestionsPanel
            seed={idea.trim() || "Fresh app inspiration"}
            stack={stack}
            stackIndex={stackIndex}
            onStackChange={setStack}
            onStackIndexChange={setStackIndex}
            onUseIdea={(text) => {
              setIdea(text);
              setStack([]);
            }}
          />
        )}

        <div className={`chips rotating${chipsIn ? " in" : " out"}`}>
          {chips.map((c) => (
            <button key={c} className="chip" onClick={() => setIdea(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

        <DemoPhone />
      </div>

      <div className="steps">
        {STEPS.map((s) => (
          <div key={s.n} className="step-card">
            <div className="step-n">{s.n}</div>
            <div className="step-title">{s.title}</div>
            <div className="step-body">{s.body}</div>
          </div>
        ))}
      </div>

      <div className="home-footer">
        Appable — for people who've never written a line of code.
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Say what you want", body: "Type it or speak it. Plain words are enough." },
  { n: "02", title: "Answer a few questions", body: "A short, friendly chat. No tech talk, promise." },
  { n: "03", title: "Watch it come alive", body: "Your app builds itself in front of you. It's a moment." },
  { n: "04", title: "Hold it in your hand", body: "Scan one code and it's on your real phone." },
];

/** A small static phone mockup showing a sample app, like the live Appable. */
function DemoPhone() {
  return (
    <div className="demo-wrap">
      <div className="demo-phone">
        <div className="demo-screen">
          <div className="demo-statusbar">9:41</div>
          <div className="demo-title">PlantPal</div>
          <div className="demo-sub">Tuesday — 3 plants need water</div>
          <button className="demo-cta">Water all</button>
          <div className="demo-row">
            <span className="demo-dot" style={{ background: "#2dd4a0" }} />
            <div>
              <div className="demo-row-title">Monstera</div>
              <div className="demo-row-sub">Living room · today</div>
            </div>
          </div>
          <div className="demo-row">
            <span className="demo-dot" style={{ background: "#ffc24a" }} />
            <div>
              <div className="demo-row-title">Fiddle Fig</div>
              <div className="demo-row-sub">Bedroom · tomorrow</div>
            </div>
          </div>
          <div className="demo-row">
            <span className="demo-dot" style={{ background: "#c8431d" }} />
            <div>
              <div className="demo-row-title">Aloe</div>
              <div className="demo-row-sub">Kitchen · in 3 days</div>
            </div>
          </div>
        </div>
      </div>
      <div className="demo-caption">an app being born, on repeat</div>
    </div>
  );
}
