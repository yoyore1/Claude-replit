/**
 * Server-side fetch proxy for generated apps (POST /api/fetch). Lets apps pull
 * live data from public APIs without browser CORS, and keeps any keys off the
 * client. Guarded against SSRF: only http/https, and no loopback/private hosts.
 */

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "::1" || h.endsWith(".localhost")) return true;
  // IPv4 literal in private / loopback / link-local ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true; // loopback / private / this-host
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // private
  }
  return false;
}

export async function proxyFetch(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  const raw = (input.url || "").trim();
  if (!raw) return { ok: false, error: "url required" };

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "invalid url" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return { ok: false, error: "only http/https allowed" };
  if (isBlockedHost(u.hostname))
    return { ok: false, error: "blocked host" };

  const method = (input.method || "GET").toUpperCase();
  try {
    const res = await fetch(u.toString(), {
      method,
      headers: input.headers,
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : typeof input.body === "string"
            ? input.body
            : input.body != null
              ? JSON.stringify(input.body)
              : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* keep as text */
    }
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" };
  }
}
