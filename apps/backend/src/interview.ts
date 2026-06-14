import { chat, interviewerConfig, type ChatMessage } from "@cr/llm";

/** Structured spec the interview converges on, handed to the builder. */
export interface AppSpec {
  name: string;
  tagline?: string;
  description: string;
  primaryColor?: string;
  backgroundColor?: string;
  screens?: { name: string; purpose: string }[];
  features?: string[];
}

export interface InterviewTurn {
  reply: string;
  done: boolean;
  spec?: AppSpec;
}

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You are the interviewer for a tool that builds React Native mobile apps from an idea.
The user will describe an app idea. Ask ONE short, friendly question at a time to clarify what to build:
its core purpose, the main screens, key features, and the visual style / color theme.
Ask at most 5 questions total, and never repeat what you already know.
When you have enough to build a first version, reply with EXACTLY a line containing:
[[READY]]
followed by a single JSON object (no markdown fences) with these keys:
{"name": string, "tagline": string, "description": string, "primaryColor": "#rrggbb",
 "backgroundColor": "#rrggbb", "screens": [{"name": string, "purpose": string}],
 "features": [string]}
Pick sensible colors if the user did not specify. Keep questions concise.`,
};

const READY = "[[READY]]";

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
    return { reply: reply.trim(), done: false };
  }

  const after = reply.slice(idx + READY.length);
  const spec = extractJson<AppSpec>(after);
  return {
    reply: "Great — I have what I need. Building your app…",
    done: true,
    spec: spec ?? undefined,
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
