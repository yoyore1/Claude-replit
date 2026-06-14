import { BACKEND_HTTP } from "./config.js";
import type { EditRequest, EditResult } from "@cr/protocol";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export async function fetchTree(): Promise<FileNode[]> {
  const r = await fetch(`${BACKEND_HTTP}/api/files`);
  const json = await r.json();
  return json.tree;
}

export async function fetchFile(path: string): Promise<string> {
  const r = await fetch(
    `${BACKEND_HTTP}/api/file?path=${encodeURIComponent(path)}`,
  );
  if (!r.ok) throw new Error((await r.json()).error ?? "read failed");
  return (await r.json()).content;
}

export async function saveFile(path: string, content: string): Promise<void> {
  const r = await fetch(`${BACKEND_HTTP}/api/file`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "save failed");
}

export async function applyEdit(req: EditRequest): Promise<EditResult> {
  const r = await fetch(`${BACKEND_HTTP}/api/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return r.json();
}

/* ------------------------------ AI funnel ---------------------------------- */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiStatus {
  interviewer: boolean;
  builder: boolean;
}

export async function aiStatus(): Promise<AiStatus> {
  try {
    const r = await fetch(`${BACKEND_HTTP}/api/ai/status`);
    return await r.json();
  } catch {
    return { interviewer: false, builder: false };
  }
}

export interface InterviewTurn {
  reply: string;
  done: boolean;
  spec?: unknown;
}

export async function interview(
  messages: ChatMessage[],
): Promise<InterviewTurn> {
  const r = await fetch(`${BACKEND_HTTP}/api/interview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error((await r.json()).error ?? "interview failed");
  return r.json();
}

export interface BuildResult {
  ok: boolean;
  files?: string[];
  error?: string;
}

export async function build(input: {
  spec?: unknown;
  idea?: string;
}): Promise<BuildResult> {
  const r = await fetch(`${BACKEND_HTTP}/api/build`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return r.json();
}

export async function aiEdit(
  source: EditRequest["source"],
  instruction: string,
): Promise<EditResult> {
  const r = await fetch(`${BACKEND_HTTP}/api/ai-edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source, instruction }),
  });
  return r.json();
}
