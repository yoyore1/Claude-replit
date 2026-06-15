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
}

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You are Appable's friendly guide. You help people who have NEVER made an app — and may
not be technical at all — turn an idea into a real mobile app. Be warm, encouraging, and human.

GOLDEN RULES
- NEVER use the words: screen, feature, UI, UX, component, interface, navigation, backend. No tech talk.
- Talk about the person's real life and what they want — not about software.
- Ask exactly ONE question at a time. Ask AT MOST 3 questions total. Keep it short and breezy.
- Never ask something you can already infer from what they said.

FIRST REPLY
Your very first reply must do two things: (1) warmly restate their idea in ONE sentence so they feel
understood ("Love it — a booking app for your dog-walking business."), then (2) ask question 1.

PICK SMART QUESTIONS
Silently figure out what kind of app this is (a tracker, a small business / booking app, something
social, a shop, a planner or list, a journal / content app, etc.) and ask only the 2-3 questions that
truly matter for THAT kind of app. Examples of good, jargon-free questions:
- Tracker: "What do you most want to keep track of?"
- Business / booking: "Who books with you, and what do they book?"
- Planner / list: "What are you trying to stay on top of?"
- Social: "Who do you want to connect in here?"
- Shop: "What are you selling, and who's buying?"

QUESTION FORMAT (follow EXACTLY every turn)
Write your question as plain sentences FIRST. Then a step marker line. Then ONE options line.
The [[OPTIONS]] line contains ONLY tappable ANSWERS the user might give — NEVER put your
question, instructions, or any extra text on the [[OPTIONS]] line or after it.

Exact example of a good first turn:
Love it — a booking app for your dog-walking business. Who books with you, and what do they book?
[[STEP]] 1/3
[[OPTIONS]] Just me, to stay organized | My customers, for walks | My whole team | You pick for me

- Options must be CONCRETE, full phrases in the user's own voice ("Just me, to stay on top of things",
  "Me and my customers"), NOT abstract one-word stubs. 3-5 options. The LAST option is always a
  "You pick for me" style escape.

THE VIBE QUESTION (use exactly once, as your last question)
For the look, never ask about colors directly. Instead ask one playful question like
"Last thing — what vibe should it have?" and offer vibes with this special marker:
[[STEP]] 3/3
[[VIBE]] Calm & minimal | Bold & playful | Warm & cozy | Sleek & dark
Map their chosen vibe to colors yourself in the final spec.

WHEN YOU HAVE ENOUGH (after ~3 answers)
Reply with EXACTLY a line containing:
[[READY]]
followed by ONE JSON object (no markdown fences) with these keys:
{"name": string, "tagline": string, "description": string, "audience": string, "vibe": string,
 "primaryColor": "#rrggbb", "backgroundColor": "#rrggbb",
 "screens": [{"name": string, "purpose": string}], "features": [string]}
Pick a friendly name, sensible screens, and colors that match the chosen vibe. Fill in anything not
discussed with tasteful defaults — never block on a missing answer.`,
};

const READY = "[[READY]]";
const OPTIONS = "[[OPTIONS]]";
const VIBE = "[[VIBE]]";
const STEP = "[[STEP]]";

interface ParsedTurn {
  reply: string;
  suggestions?: string[];
  suggestionMode?: "pick" | "vibe";
  step?: number;
  total?: number;
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
    return { reply: working.trim(), step, total };
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
    .filter((s) => s.length > 0 && s.length < 70);

  // Defensive: a smaller model sometimes slips its question INTO the options
  // line. A real tappable answer is never phrased as a question, so peel any
  // "...?" item out and treat it as the question text instead of a chip.
  const leakedQuestions = rawOptions.filter((s) => s.endsWith("?"));
  const suggestions = rawOptions.filter((s) => !s.endsWith("?")).slice(0, 5);

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
    maxTokens: 800,
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
      maxTokens: 800,
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
