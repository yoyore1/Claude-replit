import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

/**
 * Tiny JSON-file store for the product layer (users, projects, chat messages).
 *
 * This is deliberately dependency-free: the whole database is one object held in
 * memory and flushed to `.data/db.json` on a short debounce. It survives backend
 * restarts but is single-process and not meant for production scale — it's the
 * local-dev equivalent of a real database for the Appable funnel.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Root for all product data (db + per-project files). Override with DATA_DIR. */
export const DATA_DIR =
  process.env.DATA_DIR || path.resolve(__dirname, "../.data");

const DB_PATH = path.join(DATA_DIR, "db.json");

export type ProjectStatus =
  | "draft" // created, interview not finished
  | "spec_ready" // interview done, spec extracted
  | "building" // build in progress
  | "running" // built + preview live
  | "sleeping" // built previously, preview idle
  | "error"; // build failed

export interface User {
  id: string;
  email: string;
  /** scrypt hash; absent for guests (who can't log in). */
  passwordHash?: string;
  salt?: string;
  isGuest: boolean;
  createdAt: number;
}

export interface AppSpecLite {
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
  spec: AppSpecLite | null;
  /** Preview endpoints filled once the project is built + activated. */
  preview: { webUrl: string; expUrl?: string } | null;
  createdAt: number;
  updatedAt: number;
}

export type Conversation = "interview" | "build" | "brainstorm";

export interface Message {
  id: string;
  projectId: string;
  conversation: Conversation;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface DB {
  users: User[];
  projects: Project[];
  messages: Message[];
}

let db: DB = { users: [], projects: [], messages: [] };

function loadSync(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      db = {
        users: parsed.users ?? [],
        projects: parsed.projects ?? [],
        messages: parsed.messages ?? [],
      };
    }
  } catch {
    db = { users: [], projects: [], messages: [] };
  }
}
loadSync();

let flushTimer: NodeJS.Timeout | null = null;
/** Debounced flush so a burst of writes costs one disk write. */
export function persist(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    try {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      await fsp.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    } catch {
      /* best-effort */
    }
  }, 150);
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString("hex")}`;
}

/* --------------------------------- users ---------------------------------- */

export function createUser(input: Omit<User, "id" | "createdAt">): User {
  const user: User = { id: id("u"), createdAt: Date.now(), ...input };
  db.users.push(user);
  persist();
  return user;
}

export function getUser(userId: string): User | undefined {
  return db.users.find((u) => u.id === userId);
}

export function getUserByEmail(email: string): User | undefined {
  const e = email.toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === e);
}

export function updateUser(userId: string, patch: Partial<User>): User | undefined {
  const u = getUser(userId);
  if (!u) return undefined;
  Object.assign(u, patch);
  persist();
  return u;
}

/* -------------------------------- projects -------------------------------- */

export function createProject(userId: string, name: string): Project {
  const now = Date.now();
  const project: Project = {
    id: id("p"),
    userId,
    name: name || "New app",
    status: "draft",
    paidAt: null,
    spec: null,
    preview: null,
    createdAt: now,
    updatedAt: now,
  };
  db.projects.push(project);
  persist();
  return project;
}

export function getProject(projectId: string): Project | undefined {
  return db.projects.find((p) => p.id === projectId);
}

export function listProjects(userId: string): Project[] {
  return db.projects
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updateProject(
  projectId: string,
  patch: Partial<Project>,
): Project | undefined {
  const p = getProject(projectId);
  if (!p) return undefined;
  Object.assign(p, patch, { updatedAt: Date.now() });
  persist();
  return p;
}

/** Re-home a project to a new owner (used when a guest claims an account). */
export function transferProjects(fromUserId: string, toUserId: string): number {
  let n = 0;
  for (const p of db.projects) {
    if (p.userId === fromUserId) {
      p.userId = toUserId;
      n++;
    }
  }
  if (n) persist();
  return n;
}

/* -------------------------------- messages -------------------------------- */

export function addMessage(input: Omit<Message, "id" | "ts">): Message {
  const msg: Message = { id: id("m"), ts: Date.now(), ...input };
  db.messages.push(msg);
  persist();
  return msg;
}

export function listMessages(
  projectId: string,
  conversation?: Conversation,
): Message[] {
  return db.messages
    .filter(
      (m) =>
        m.projectId === projectId &&
        (!conversation || m.conversation === conversation),
    )
    .sort((a, b) => a.ts - b.ts);
}
