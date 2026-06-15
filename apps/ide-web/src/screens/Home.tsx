import React, { useEffect, useState } from "react";
import type { Go } from "../App.js";
import { createProject, ensureSession, getToken } from "../api.js";
import {
  fetchInitialSuggestions,
  IdeaSuggestionsPanel,
  type ViewSet,
} from "../components/IdeaSuggestions.js";

const IDEA_POOL = [
  "Keep my habits going with daily streaks",
  "Take bookings for my dog-walking business",
  "Plan dinners and make my grocery list for me",
  "Make saving money feel like a fun game",
  "Track my workouts with my gym buddies",
  "Remind me to water my plants so they stop dying",
  "A daily journal that asks me how I'm feeling",
  "A chore chart my kids actually want to use",
  "Keep track of what's in my little online shop",
  "Save my family's secret recipes in one place",
  "Study with flash cards before my big exam",
  "Pack the perfect bag for any trip",
  "Split bills fairly with my roommates",
  "Count down to my next big trip",
  "Log my baby's feeds and naps",
  "Keep a reading list of books to finish",
  "Practice a new language a little each day",
  "Send simple invoices for my side hustle",
];

function pickThree(except: string[] = []): string[] {
  const pool = IDEA_POOL.filter((i) => !except.includes(i));
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export function Home({ go }: { go: Go }) {
  const [idea, setIdea] = useState("");
  const [chips, setChips] = useState<string[]>(() => pickThree());
  const [chipsIn, setChipsIn] = useState(true);
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

        <textarea
          className="idea-input"
          placeholder="I want an app that…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              start();
            }
          }}
        />

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
