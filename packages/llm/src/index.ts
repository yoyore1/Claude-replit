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

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e: any) {
    throw new LLMError(`Network error calling ${url}: ${e.message}`);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new LLMError(
      `LLM request failed (${res.status})`,
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

/** Interviewer brain (Qwen / Alibaba DashScope OpenAI-compatible mode). */
export function interviewerConfig(): LLMConfig {
  return fromEnv("QWEN", {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
  });
}

/** Builder brain (MiniMax OpenAI-compatible mode). */
export function builderConfig(): LLMConfig {
  return fromEnv("MINIMAX", {
    baseUrl: "https://api.minimax.io/v1",
    model: "MiniMax-M2",
  });
}

export function isConfigured(c: LLMConfig): boolean {
  return Boolean(c.baseUrl && c.apiKey && c.model);
}
