// RAG: Qwen3 embeddings → Supabase pgvector match → DeepSeek answer.
import { chat, interviewerConfig, type ChatMessage } from "@cr/llm";
import { embed } from "./deepinfra.js";

/**
 * Retrieval-augmented Q&A for generated apps:
 *   embed (Qwen3-Embedding) → Supabase pgvector similarity search → answer (DeepSeek).
 *
 * Requires a Supabase project with pgvector. One-time SQL:
 *   create extension if not exists vector;
 *   create table documents (id bigserial primary key, content text, embedding vector(1024));
 *   create or replace function match_documents(query_embedding vector(1024), match_count int)
 *   returns table (id bigint, content text, similarity float)
 *   language sql stable as $$
 *     select id, content, 1 - (embedding <=> query_embedding) as similarity
 *     from documents order by embedding <=> query_embedding limit match_count;
 *   $$;
 * Then set SUPABASE_URL and SUPABASE_KEY (service role) in apps/backend/.env.
 */
const SB_URL = () => process.env.SUPABASE_URL || "";
const SB_KEY = () => process.env.SUPABASE_KEY || "";

function sbHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    apikey: SB_KEY(),
    authorization: `Bearer ${SB_KEY()}`,
  };
}

function configured(): boolean {
  return Boolean(SB_URL() && SB_KEY());
}

/** Add a document to ONE app's knowledge base (embed + store, scoped by app_id). */
export async function indexDoc(
  content: string,
  appId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!configured()) return { ok: false, error: "Supabase not configured" };
  if (!content?.trim()) return { ok: false, error: "content required" };
  const e = await embed([content]);
  if (!e.ok || !e.vectors?.[0]) return { ok: false, error: e.error || "embed failed" };
  try {
    const res = await fetch(`${SB_URL()}/rest/v1/documents`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({ content, embedding: e.vectors[0], app_id: appId || "default" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `supabase ${res.status}: ${await res.text()}` };
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "index failed" };
  }
}

/** Answer a question grounded in ONE app's stored documents (scoped by app_id). */
export async function ragQuery(
  question: string,
  appId: string,
  matchCount = 5,
): Promise<{ ok: boolean; answer?: string; sources?: string[]; error?: string }> {
  if (!configured()) return { ok: false, error: "Supabase not configured" };
  if (!question?.trim()) return { ok: false, error: "question required" };
  const e = await embed([question]);
  if (!e.ok || !e.vectors?.[0]) return { ok: false, error: e.error || "embed failed" };
  let chunks: string[] = [];
  try {
    const res = await fetch(`${SB_URL()}/rest/v1/rpc/match_documents`, {
      method: "POST",
      headers: sbHeaders(),
      body: JSON.stringify({
        query_embedding: e.vectors[0],
        match_count: matchCount,
        p_app_id: appId || "default",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { ok: false, error: `supabase ${res.status}: ${await res.text()}` };
    const rows = (await res.json()) as any[];
    chunks = rows.map((r) => r.content).filter(Boolean);
  } catch (err: any) {
    return { ok: false, error: err?.message || "search failed" };
  }
  const context = chunks.join("\n---\n") || "(no documents found)";
  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Answer the user's question using ONLY the context below. If the answer isn't in it, say you don't know.\n\nContext:\n" +
        context,
    },
    { role: "user", content: question },
  ];
  try {
    const answer = await chat(interviewerConfig(), {
      messages,
      temperature: 0.2,
      maxTokens: 1024,
    });
    return { ok: true, answer: answer.trim(), sources: chunks };
  } catch (err: any) {
    return { ok: false, error: err?.message || "answer failed" };
  }
}
