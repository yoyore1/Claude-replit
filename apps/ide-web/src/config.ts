// Endpoints the IDE talks to. Override via Vite env vars when hosting elsewhere.
const env = import.meta.env as Record<string, string | undefined>;

export const BACKEND_HTTP =
  env.VITE_BACKEND_HTTP || "http://localhost:8787";
export const BACKEND_WS =
  env.VITE_BACKEND_WS || "ws://localhost:8787/ide";
/** URL of the running Expo web preview (Metro dev server). */
export const PREVIEW_URL = env.VITE_PREVIEW_URL || "http://localhost:8081";
