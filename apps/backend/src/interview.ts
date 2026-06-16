import { chat, interviewerConfig, type ChatMessage } from "@cr/llm";

/** Structured spec the interview converges on, handed to the builder. */
export interface AppSpec {
  name: string;
  tagline?: string;
  description?: string;
  /** Who the app is for (captured in plain language during the interview). */
  audience?: string;
  /** Chosen visual vibe, e.g. "Calm & minimal" — maps to the colors below. */
  vibe?: string;
  primaryColor?: string;
  backgroundColor?: string;
  screens?: { name: string; purpose: string }[];
  features?: string[];
}

export interface InterviewTurn {
  reply: string;
  done: boolean;
  spec?: AppSpec;
  /** Short tappable example answers for the latest question (chips). */
  suggestions?: string[];
  /** Which question number this is (1-based) and how many total. */
  step?: number;
  total?: number;
  /** How the suggestions should be presented on the frontend. */
  suggestionMode?: "pick" | "vibe";
  /** The answer Appable would choose for this question — precomputed in the SAME
   *  turn so "Let Appable pick" is instant (no extra round-trip). */
  appablePick?: string;
  /** For the look question: per-vibe swatch colors [main, background]. */
  swatches?: Record<string, string[]>;
}

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You are Appable's friendly guide. You help people who have NEVER made an app — and may
not be technical at all — turn an idea into a real mobile app. Be warm, encouraging, and human.

GOLDEN RULES
- NEVER use the words: screen, feature, UI, UX, component, interface, navigation, backend. No tech talk.
- Talk about the person's real life and what they want — not about software.
- Ask exactly ONE question at a time. Ask 3-4 questions total. Keep it short and breezy.
- Never ask something you can already infer from what they said — if their idea already answers a
  question, SKIP it and move on.
- Silently figure out what kind of app this is FIRST, then tailor every question, every option, the
  name ideas, and the colors to THAT specific app.

FIRST REPLY
Your very first reply must do two things: (1) warmly restate their idea in ONE sentence so they feel
understood ("Love it — a booking app for your dog-walking business."), then (2) ask question 1.

WHAT TO ASK (in a natural order, ~3-4 total — skip any the idea already answers)
1. THE HEART of this kind of app — the one thing that matters most. Examples:
   - Tracker: "What do you most want to keep track of?"
   - Business / booking: "Who books with you, and what do they book?"
   - Shop: "What are you selling, and who's buying?"
2. THE MAIN THINGS they want to be able to DO — everyday actions in plain words ("add a prayer time",
   "log a workout", "save a recipe"). SKIP this if their idea already spells the main things out.
   These answers can be multi-picked, so offer a handful of real ones.
3. THE NAME — "What should we call it?" Offer a few names that genuinely fit this app.
4. THE LOOK — always last (see THE LOOK).

QUESTION FORMAT (follow EXACTLY every turn)
Question as plain sentences FIRST. Then a step line. Then ONE options line. Then ONE pick line.
[[STEP]] 1/4
[[OPTIONS]] real answer 1 | real answer 2 | real answer 3
[[PICK]] the single best of those answers for THIS app

Exact example of a good first turn:
Love it — a booking app for your dog-walking business. Who books with you, and what do they book?
[[STEP]] 1/4
[[OPTIONS]] Just me, to stay organized | My customers, for walks | My whole team
[[PICK]] My customers, for walks

- Options must be CONCRETE, full phrases in the user's own voice, 3-4 REAL answers. For the NAME
  question they're candidate names; for the MAIN THINGS question they're everyday actions.
- [[PICK]] is REQUIRED on every question: the one answer Appable would choose if it had to decide —
  genuinely the best fit for this app, not random. The app offers a "Let Appable pick" button that
  uses it, so it must be a real, complete answer (one of the options, or an even better one).
- Do NOT add a "You pick for me" / "Let Appable pick" / "Not sure" option in [[OPTIONS]] — the app
  shows that button automatically and uses your [[PICK]].
- If the user's answer comes back as your suggested pick, just treat it as their choice and continue.

THE LOOK (use once, as the LAST question) — the colors MUST suit what they're building
Never ask about colors as hex. Ask a warm question ("Last thing — what should it feel like?") and
offer 3-4 looks that FIT THIS app, each with two hex colors: a main color + a soft background. Match
real-world meaning — e.g. an Islamic / Muslim app → greens; finance → deep blue or green; a kids app
→ bright & playful; wellness → calm naturals; luxury → black & gold; food → warm appetizing tones.
Use this EXACT marker, "Name ~ #mainHex,#bgHex" per look:
[[STEP]] 4/4
[[VIBE]] Serene Green ~ #1f7a4d,#f1f8f3 | Warm Gold ~ #b8860b,#fffdf5 | Calm Cream ~ #6b5b45,#faf6ef
[[PICK]] Serene Green
Choose colors that genuinely reflect the app's subject — do NOT reuse the same generic palette for
every app.

WHEN YOU HAVE ENOUGH (after the questions)
Reply with EXACTLY a line containing:
[[READY]]
followed by ONE JSON object (no markdown fences) with these keys:
{"name": string, "tagline": string, "description": string, "audience": string, "vibe": string,
 "primaryColor": "#rrggbb", "backgroundColor": "#rrggbb",
 "screens": [{"name": string, "purpose": string}], "features": [string]}
Use the name they chose, the main things they picked as features, sensible screens, and set
primaryColor/backgroundColor to the chosen look's two colors — which must suit the app's domain.
Fill anything not discussed with tasteful, on-theme defaults — never block on a missing answer.`,
};

const READY = "[[READY]]";
const OPTIONS = "[[OPTIONS]]";
const VIBE = "[[VIBE]]";
const STEP = "[[STEP]]";
const PICK = "[[PICK]]";

interface ParsedTurn {
  reply: string;
  suggestions?: string[];
  suggestionMode?: "pick" | "vibe";
  step?: number;
  total?: number;
  appablePick?: string;
  swatches?: Record<string, string[]>;
}

/**
 * Parse the model's reply into a clean question + tappable options + step info.
 * Tolerant of a smaller model: any missing marker just degrades gracefully
 * (e.g. a plain question with no chips, or chips with no step counter).
 */
function parseTurn(text: string): ParsedTurn {
  let working = text;
  let step: number | undefined;
  let total: number | undefined;

  // Pull "[[STEP]] n/m" wherever it sits.
  const stepMatch = working.match(/\[\[STEP\]\]\s*(\d+)\s*\/\s*(\d+)/i);
  if (stepMatch) {
    step = Number(stepMatch[1]);
    total = Number(stepMatch[2]);
    working = working.replace(stepMatch[0], "");
  }

  // Pull the "[[PICK]] <answer>" line (Appable's precomputed best answer) out
  // BEFORE we parse options, so it never leaks into the question text.
  let appablePick: string | undefined;
  const pickMatch = working.match(/\[\[PICK\]\]\s*([^\n]+)/i);
  if (pickMatch) {
    appablePick = pickMatch[1].split("|")[0].trim() || undefined;
    working = working.replace(pickMatch[0], "");
  }

  // Find whichever options marker appears first.
  const optIdx = working.indexOf(OPTIONS);
  const vibeIdx = working.indexOf(VIBE);
  let marker = "";
  let idx = -1;
  let mode: "pick" | "vibe" = "pick";
  if (vibeIdx !== -1 && (optIdx === -1 || vibeIdx < optIdx)) {
    marker = VIBE;
    idx = vibeIdx;
    mode = "vibe";
  } else if (optIdx !== -1) {
    marker = OPTIONS;
    idx = optIdx;
    mode = "pick";
  }

  if (idx === -1) {
    return { reply: working.trim(), step, total, appablePick };
  }

  // Text before the marker is the question. The options are ONLY the first line
  // after the marker — a smaller model sometimes trails the question AFTER the
  // options block, so anything on later lines is folded back into the question
  // (and never pollutes the last chip).
  const before = working.slice(0, idx).trim();
  const afterMarker = working.slice(idx + marker.length);
  const nl = afterMarker.indexOf("\n");
  const optionsLine = nl === -1 ? afterMarker : afterMarker.slice(0, nl);
  const trailing = nl === -1 ? "" : afterMarker.slice(nl + 1).trim();

  const rawOptions = optionsLine
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 80);

  // For the look question, each option may carry its swatch as "Name ~ #c1,#c2".
  // Split the label from the colors and collect a label→[main,bg] map.
  const swatches: Record<string, string[]> = {};
  const splitVibe = (raw: string): string => {
    if (mode !== "vibe" || !raw.includes("~")) return raw;
    const [labelPart, colorPart] = raw.split("~");
    const label = labelPart.trim();
    const colors = (colorPart || "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c));
    if (label && colors.length) swatches[label] = colors.slice(0, 2);
    return label;
  };
  const cleaned = rawOptions.map(splitVibe);

  // Defensive: a smaller model sometimes slips its question INTO the options
  // line. A real tappable answer is never phrased as a question, so peel any
  // "...?" item out and treat it as the question text instead of a chip.
  const leakedQuestions = cleaned.filter((s) => s.endsWith("?"));
  const suggestions = cleaned.filter((s) => !s.endsWith("?")).slice(0, 5);

  const reply = [before, ...leakedQuestions, trailing]
    .filter(Boolean)
    .join("\n")
    .trim();
  return {
    reply,
    suggestions: suggestions.length ? suggestions : undefined,
    suggestionMode: suggestions.length ? mode : undefined,
    step,
    total,
    appablePick,
    swatches: Object.keys(swatches).length ? swatches : undefined,
  };
}

/**
 * Run one interview turn. Pass the full message history (excluding the system
 * prompt); returns the interviewer's next message, and—when it has enough—the
 * final structured spec so the build step can start.
 */
export async function interviewTurn(
  history: ChatMessage[],
): Promise<InterviewTurn> {
  const reply = await chat(interviewerConfig(), {
    messages: [SYSTEM, ...history],
    temperature: 0.6,
    // Generous budget: this is a reasoning model (reasoning_content is separate),
    // and too small a budget makes it spill its thinking into the reply / truncate
    // the [[OPTIONS]]/[[PICK]] block.
    maxTokens: 2200,
  });

  const idx = reply.indexOf(READY);
  if (idx === -1) {
    const parsed = parseTurn(reply);
    return {
      reply: parsed.reply,
      done: false,
      suggestions: parsed.suggestions,
      suggestionMode: parsed.suggestionMode,
      step: parsed.step,
      total: parsed.total,
      appablePick: parsed.appablePick,
      swatches: parsed.swatches,
    };
  }

  const after = reply.slice(idx + READY.length);
  const spec = extractJson<AppSpec>(after);
  return {
    reply: "Perfect — I've got everything I need. Here's your app plan.",
    done: true,
    spec: spec ?? undefined,
  };
}

/**
 * Force a spec out of whatever conversation we have so far (used by /spec/ensure
 * after payment, when the user may have skipped the natural wrap-up). Falls back
 * to a minimal spec built from the idea text if the model misbehaves.
 */
export async function finalizeSpec(
  history: ChatMessage[],
  fallbackIdea: string,
): Promise<AppSpec> {
  const nudge: ChatMessage = {
    role: "system",
    content: `Based on the conversation so far, output NOW the final app spec.
Reply with EXACTLY one JSON object (no prose, no markdown fences, no questions) with keys:
{"name": string, "tagline": string, "description": string, "audience": string, "vibe": string,
 "primaryColor": "#rrggbb", "backgroundColor": "#rrggbb",
 "screens": [{"name": string, "purpose": string}], "features": [string]}
Pick sensible values for anything not discussed.`,
  };
  try {
    const reply = await chat(interviewerConfig(), {
      messages: [SYSTEM, ...history, nudge],
      temperature: 0.4,
      maxTokens: 2200,
    });
    const spec = extractJson<AppSpec>(reply);
    if (spec?.name) return spec;
  } catch {
    /* fall through to minimal spec */
  }
  return {
    name: fallbackIdea.slice(0, 40) || "My App",
    tagline: "Made just for you with Appable",
    description: fallbackIdea || "A simple mobile app.",
    audience: "Anyone who'd find this handy",
    vibe: "Calm & minimal",
    primaryColor: "#007AFF",
    backgroundColor: "#FFFFFF",
    screens: [{ name: "Home", purpose: "Main screen" }],
    features: [],
  };
}

/** Pull the first {...} JSON object out of a string, tolerating fences/prose. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.replace(/```(?:json)?/gi, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
