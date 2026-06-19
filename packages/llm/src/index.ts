/**
 * Provider-agnostic LLM client.
 *
 * Both of our "brains" speak the OpenAI-compatible Chat Completions protocol:
 *   - the Interviewer (Qwen / DashScope) asks adaptive questions about the idea
 *   - the Builder  (MiniMax) writes the React Native code and does AI edits
 *
 * Each is just a base URL + model + API key, so we keep ONE client and configure
 * two roles from environment variables. Nothing here is provider-specific.
 */

/** OpenAI-compatible multimodal content parts (used for vision). */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  /** Plain text, or content parts (text + image_url) for vision-capable models. */
  content: string | ContentPart[];
}

export interface LLMConfig {
  baseUrl: string; // e.g. https://dashscope-intl.aliyuncs.com/compatible-mode/v1
  apiKey: string;
  model: string;
  /** Override the path if a provider deviates from /chat/completions. */
  chatPath?: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a JSON object response when supported. */
  json?: boolean;
  signal?: AbortSignal;
  /** Hard timeout in ms (default 60s) so a hung provider can't hang forever. */
  timeoutMs?: number;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/** One non-streaming chat completion. Returns the assistant's text. */
export async function chat(
  config: LLMConfig,
  opts: ChatOptions,
): Promise<string> {
  if (!config.apiKey) {
    throw new LLMError(`Missing API key for model ${config.model}`);
  }
  const url = joinUrl(config.baseUrl, config.chatPath ?? "/chat/completions");

  const body: Record<string, unknown> = {
    model: config.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  // Hard timeout so a hung provider can't wedge a turn forever. Combine our
  // timeout with any caller-provided signal.
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const timer = new AbortController();
  const onAbort = () => timer.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const timeout = setTimeout(() => timer.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: timer.signal,
    });
  } catch (e: any) {
    const aborted = timer.signal.aborted && !opts.signal?.aborted;
    throw new LLMError(
      aborted
        ? `LLM request timed out after ${Math.round(timeoutMs / 1000)}s calling ${url}`
        : `Network error calling ${url}: ${e.message}`,
    );
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onAbort);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new LLMError(
      `LLM request failed (${res.status}): ${text.slice(0, 200)}`,
      res.status,
      text.slice(0, 500),
    );
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new LLMError(`Non-JSON response from ${url}`, res.status, text.slice(0, 300));
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LLMError(
      "Unexpected response shape (no choices[0].message.content)",
      res.status,
      JSON.stringify(json).slice(0, 300),
    );
  }
  return content;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

/* ------------------------------ role configs -------------------------------- */

function fromEnv(prefix: string, defaults: Partial<LLMConfig>): LLMConfig {
  const e = process.env;
  return {
    baseUrl: e[`${prefix}_BASE_URL`] || defaults.baseUrl || "",
    apiKey: e[`${prefix}_API_KEY`] || "",
    model: e[`${prefix}_MODEL`] || defaults.model || "",
    chatPath: e[`${prefix}_CHAT_PATH`] || defaults.chatPath,
  };
}

/**
 * Interviewer brain — a FAST, non-reasoning instruct model. A reasoning model
 * (its hidden chain-of-thought) made interview turns slow/variable; the interview
 * is just a friendly Q&A, so we default to Qwen3-Next-80B-A3B-Instruct on
 * DeepInfra (MoE, ~3B active → snappy). The API key falls back to DEEPINFRA_API_KEY
 * so no separate QWEN_API_KEY is needed when using the DeepInfra default. Any
 * QWEN_* env var still overrides (e.g. to point back at Fireworks).
 */
export function interviewerConfig(): LLMConfig {
  const e = process.env;
  return {
    baseUrl: e.QWEN_BASE_URL || "https://api.deepinfra.com/v1/openai",
    apiKey: e.QWEN_API_KEY || e.DEEPINFRA_API_KEY || "",
    model: e.QWEN_MODEL || "Qwen/Qwen3-Next-80B-A3B-Instruct",
    chatPath: e.QWEN_CHAT_PATH,
  };
}

/** Builder brain (MiniMax OpenAI-compatible mode). */
export function builderConfig(): LLMConfig {
  return fromEnv("MINIMAX", {
    baseUrl: "https://api.fireworks.ai/inference/v1",
    model: "accounts/fireworks/models/minimax-m3",
  });
}

/**
 * Vision/AI brain that generated apps call at runtime (image Q&A + smart text).
 * Defaults to Qwen3-VL on DeepInfra (OpenAI-compatible); set VISION_* to override.
 */
export function visionConfig(): LLMConfig {
  const e = process.env;
  return {
    baseUrl: e.VISION_BASE_URL || "https://api.deepinfra.com/v1/openai",
    apiKey: e.VISION_API_KEY || "",
    model: e.VISION_MODEL || "Qwen/Qwen3-VL-30B-A3B-Instruct",
    chatPath: e.VISION_CHAT_PATH,
  };
}

export function isConfigured(c: LLMConfig): boolean {
  return Boolean(c.baseUrl && c.apiKey && c.model);
}
