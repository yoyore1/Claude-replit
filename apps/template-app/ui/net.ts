import { Platform } from "react-native";

/**
 * Internet + AI for generated apps, via the Appable backend hub:
 *  - apiGet / apiPost  → fetch any public API (proxied: no CORS, keys stay server-side)
 *  - askAI             → a text answer from the model
 *  - classifyImage     → ask a question about an image (data URL)
 * All fail soft (return null / "") so a screen never crashes on a network error.
 */

// Each generated app gets a unique id (set once at startup by App.tsx) so its
// cloud data — currently the RAG knowledge base — stays separate from other apps.
let APP_ID = "default";
/** Set this app's id. Called once from the generated App.tsx. */
export function setAppId(id: string): void {
  if (id) APP_ID = id;
}

/** Where the backend lives. Web: same host on :8787. Native: EXPO_PUBLIC_APPABLE_API. */
export function apiBase(): string {
  if (Platform.OS === "web" && typeof location !== "undefined") {
    return `${location.protocol}//${location.hostname}:8787`;
  }
  return (
    (typeof process !== "undefined" &&
      (process.env as any)?.EXPO_PUBLIC_APPABLE_API) ||
    "http://localhost:8787"
  );
}

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(apiBase() + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Ask the AI a question; returns the answer text (or "" on failure). */
export async function askAI(prompt: string): Promise<string> {
  try {
    const r = await postJson("/api/ai", { prompt });
    return r?.answer ?? "";
  } catch {
    return "";
  }
}

/** Ask the AI about an image (a `data:` URL, e.g. from pickImage({base64:true})). */
export async function classifyImage(
  imageDataUrl: string,
  question: string,
): Promise<string> {
  try {
    const r = await postJson("/api/ai", { prompt: question, image: imageDataUrl });
    return r?.answer ?? "";
  } catch {
    return "";
  }
}

/** GET any public API (proxied). Returns parsed JSON, or null on failure. */
export async function apiGet(
  url: string,
  opts?: { headers?: Record<string, string> },
): Promise<any> {
  try {
    const r = await postJson("/api/fetch", { url, headers: opts?.headers });
    return r?.ok ? r.data : null;
  } catch {
    return null;
  }
}

/** POST to any public API (proxied). Returns parsed JSON, or null on failure. */
export async function apiPost(
  url: string,
  body?: unknown,
  opts?: { headers?: Record<string, string> },
): Promise<any> {
  try {
    const r = await postJson("/api/fetch", {
      url,
      method: "POST",
      body,
      headers: opts?.headers,
    });
    return r?.ok ? r.data : null;
  } catch {
    return null;
  }
}

/** Generate an image from a prompt. Returns an image URL (use in <Image>), or null. */
export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const r = await postJson("/api/image", { prompt });
    return r?.ok ? r.url : null;
  } catch {
    return null;
  }
}

/** Transcribe an audio clip (a `data:` URL or base64) to text. */
export async function transcribe(audioDataUrl: string): Promise<string> {
  try {
    const r = await postJson("/api/stt", { audio: audioDataUrl });
    return r?.text ?? "";
  } catch {
    return "";
  }
}

/** Embed texts into vectors (semantic search / similarity). null on failure. */
export async function embed(texts: string[]): Promise<number[][] | null> {
  try {
    const r = await postJson("/api/embed", { input: texts });
    return r?.ok ? r.vectors : null;
  } catch {
    return null;
  }
}

/** RAG: add a document to THIS app's knowledge base (needs Supabase configured). */
export async function indexDoc(content: string): Promise<boolean> {
  try {
    const r = await postJson("/api/rag/index", { content, appId: APP_ID });
    return !!r?.ok;
  } catch {
    return false;
  }
}

/** RAG: answer a question grounded in THIS app's indexed documents. */
export async function askDocs(question: string): Promise<string> {
  try {
    const r = await postJson("/api/rag/query", { question, appId: APP_ID });
    return r?.answer ?? "";
  } catch {
    return "";
  }
}
