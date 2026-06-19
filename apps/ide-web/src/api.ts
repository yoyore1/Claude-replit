import { BACKEND_HTTP, BACKEND_WS } from "./config.js";
import type { EditRequest, EditResult } from "@cr/protocol";

/* ============================ auth / session ============================== */

const TOKEN_KEY = "appable_token";
const EMAIL_KEY = "appable_email";
const GUEST_DOMAIN = "guest.appable.dev";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getUserEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}
export function setUserEmail(e: string | null) {
  if (e) localStorage.setItem(EMAIL_KEY, e);
  else localStorage.removeItem(EMAIL_KEY);
}
export function isGuest(): boolean {
  const email = getUserEmail();
  return !email || email.endsWith(`@${GUEST_DOMAIN}`);
}

/** Authenticated JSON fetch against the backend. Throws on non-2xx. */
export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = opts.method ?? "GET";
  const body =
    opts.body !== undefined
      ? JSON.stringify(opts.body)
      : method !== "GET" && method !== "HEAD"
        ? "{}"
        : undefined;
  const res = await fetch(`${BACKEND_HTTP}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
    },
    body,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}) as any);
    throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Make sure we have a token; mint a guest session if not. */
export async function ensureSession(): Promise<void> {
  if (getToken()) return;
  const res = await api<{ token: string; user: { email: string } }>(
    "/auth/guest",
    { method: "POST" },
  );
  setToken(res.token);
  setUserEmail(res.user.email);
}

export function wsUrl(projectId: string): string {
  return `${BACKEND_WS.replace(/\/ide$/, "")}/ws?projectId=${encodeURIComponent(
    projectId,
  )}&token=${encodeURIComponent(getToken() ?? "")}`;
}

/* ============================== auth calls ================================ */

export interface AuthResult {
  token: string;
  user: { email: string };
}

export async function claimAccount(email: string, password: string) {
  return api<AuthResult>("/auth/claim", {
    method: "POST",
    body: { email, password },
  });
}

export async function login(
  email: string,
  password: string,
  guestToken?: string | null,
  transferProjectId?: string,
) {
  return api<AuthResult>("/auth/login", {
    method: "POST",
    body: { email, password, guestToken, transferProjectId },
  });
}

/* =============================== projects ================================= */

export type ProjectStatus =
  | "draft"
  | "spec_ready"
  | "building"
  | "running"
  | "sleeping"
  | "error";

export interface AppSpec {
  name: string;
  tagline?: string;
  description?: string;
  primaryColor?: string;
  backgroundColor?: string;
  screens?: { name: string; purpose: string }[];
  features?: string[];
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  paidAt: number | null;
  spec: AppSpec | null;
  preview: { webUrl: string; expUrl?: string } | null;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversation: "interview" | "build" | "brainstorm";
  ts: number;
}

export const listProjects = () => api<Project[]>("/projects");
export const createProject = (name: string) =>
  api<Project>("/projects", { method: "POST", body: { name } });
export const getProject = (id: string) => api<Project>(`/projects/${id}`);
export const payProject = (id: string) =>
  api<Project>(`/projects/${id}/pay`, { method: "POST" });
export const ensureSpec = (id: string) =>
  api<{ spec: AppSpec }>(`/projects/${id}/spec/ensure`, { method: "POST" });
export const getMessages = (id: string, kind?: string) =>
  api<ProjectMessage[]>(
    `/projects/${id}/messages${kind ? `?kind=${kind}` : ""}`,
  );

/* ============================ included documents ========================== */

export interface DocSection {
  heading: string;
  body: string;
}
export interface Doc {
  title: string;
  sections: DocSection[];
}
export interface AppDocs {
  privacy: Doc;
  terms: Doc;
  support: Doc;
}

export const getDocs = (id: string) => api<AppDocs>(`/projects/${id}/docs`);

/* ================================ ideas =================================== */

export interface Idea {
  title: string;
  pitch: string;
}
export interface IdeaSet {
  gold: Idea;
  silver: [Idea, Idea];
}

export function suggestIdeas(body: {
  mode: "initial" | "random" | "similar";
  seed?: string;
  basedOn?: { title: string; pitch: string };
}) {
  return api<IdeaSet>("/ideas/suggest", { method: "POST", body });
}

/* ===================== tap-to-edit (Build screen) ======================== */

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export async function fetchTree(): Promise<FileNode[]> {
  const r = await fetch(`${BACKEND_HTTP}/api/files`);
  return (await r.json()).tree;
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

/* ------------------------------ edit history ------------------------------ */

export interface HistoryEntryView {
  id: string;
  ts: number;
  label: string;
  file: string;
}
export interface HistoryView {
  entries: HistoryEntryView[];
  cursor: number;
}
export interface RestoreResult {
  ok: boolean;
  error?: string;
  files: string[];
  cursor: number;
  view?: HistoryView;
}

export const fetchHistory = () =>
  fetch(`${BACKEND_HTTP}/api/history`).then((r) => r.json() as Promise<HistoryView>);
export const historyUndo = () =>
  fetch(`${BACKEND_HTTP}/api/history/undo`, { method: "POST" }).then(
    (r) => r.json() as Promise<RestoreResult>,
  );
export const historyRedo = () =>
  fetch(`${BACKEND_HTTP}/api/history/redo`, { method: "POST" }).then(
    (r) => r.json() as Promise<RestoreResult>,
  );
export const historyRestore = (index: number) =>
  fetch(`${BACKEND_HTTP}/api/history/restore`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ index }),
  }).then((r) => r.json() as Promise<RestoreResult>);
