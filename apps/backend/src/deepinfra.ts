/**
 * DeepInfra-backed capabilities for generated apps: image generation, text-to-
 * speech, speech-to-text, and embeddings. One key, OpenAI-compatible where
 * possible. Each returns a plain result and fails soft with an error string.
 */
const BASE = process.env.DEEPINFRA_BASE_URL || "https://api.deepinfra.com";
const KEY = () => process.env.DEEPINFRA_API_KEY || process.env.VISION_API_KEY || "";

const IMAGE_MODEL = process.env.IMAGE_MODEL || "ByteDance/Seedream-4.5";
// Seedream-4.5 requires size >= 3,686,400 px; 2048x2048 (4.2M) satisfies it.
const IMAGE_SIZE = process.env.IMAGE_SIZE || "2048x2048";
const TTS_MODEL = process.env.TTS_MODEL || "hexgrad/Kokoro-82M";
const STT_MODEL = process.env.STT_MODEL || "openai/whisper-large-v3-turbo";
const EMBED_MODEL = process.env.EMBED_MODEL || "Qwen/Qwen3-Embedding-0.6B";

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${KEY()}` };
  if (json) h["content-type"] = "application/json";
  return h;
}

/** Text → image. Returns an image URL (or data URL). */
export async function generateImage(
  prompt: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!KEY()) return { ok: false, error: "DEEPINFRA_API_KEY not set" };
  if (!prompt?.trim()) return { ok: false, error: "prompt required" };
  try {
    const res = await fetch(`${BASE}/v1/openai/images/generations`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: IMAGE_SIZE, n: 1 }),
      signal: AbortSignal.timeout(120000),
    });
    const j: any = await res.json();
    if (!res.ok) return { ok: false, error: j?.error?.message || `image ${res.status}` };
    const d = j?.data?.[0];
    const url = d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null);
    return url ? { ok: true, url } : { ok: false, error: "no image returned" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "image failed" };
  }
}

/** Text → speech. Returns an audio data URL (wav). */
export async function textToSpeech(
  text: string,
): Promise<{ ok: boolean; audio?: string; error?: string }> {
  if (!KEY()) return { ok: false, error: "DEEPINFRA_API_KEY not set" };
  if (!text?.trim()) return { ok: false, error: "text required" };
  try {
    const res = await fetch(`${BASE}/v1/inference/${TTS_MODEL}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(60000),
    });
    const j: any = await res.json();
    if (!res.ok) return { ok: false, error: j?.error || `tts ${res.status}` };
    return j?.audio ? { ok: true, audio: j.audio } : { ok: false, error: "no audio returned" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "tts failed" };
  }
}

/** Speech → text. Accepts a base64 (optionally data-URL) audio clip. */
export async function transcribe(
  audioBase64: string,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!KEY()) return { ok: false, error: "DEEPINFRA_API_KEY not set" };
  if (!audioBase64) return { ok: false, error: "audio required" };
  try {
    const b64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const buf = Buffer.from(b64, "base64");
    const fd = new FormData();
    fd.append("model", STT_MODEL);
    fd.append("file", new Blob([buf], { type: "audio/m4a" }), "audio.m4a");
    const res = await fetch(`${BASE}/v1/openai/audio/transcriptions`, {
      method: "POST",
      headers: authHeaders(false), // let fetch set multipart boundary
      body: fd,
      signal: AbortSignal.timeout(60000),
    });
    const j: any = await res.json();
    if (!res.ok) return { ok: false, error: j?.error?.message || `stt ${res.status}` };
    return { ok: true, text: j?.text ?? "" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "stt failed" };
  }
}

/** Embed one or more texts → vectors (for search / RAG). */
export async function embed(
  input: string[],
): Promise<{ ok: boolean; vectors?: number[][]; error?: string }> {
  if (!KEY()) return { ok: false, error: "DEEPINFRA_API_KEY not set" };
  if (!input?.length) return { ok: false, error: "input required" };
  try {
    const res = await fetch(`${BASE}/v1/openai/embeddings`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ model: EMBED_MODEL, input }),
      signal: AbortSignal.timeout(60000),
    });
    const j: any = await res.json();
    if (!res.ok) return { ok: false, error: j?.error?.message || `embed ${res.status}` };
    return { ok: true, vectors: (j?.data ?? []).map((d: any) => d.embedding) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "embed failed" };
  }
}
