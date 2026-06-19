import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import type { EditRequest, SourceLocation } from "@cr/protocol";
import type { ChatMessage } from "@cr/llm";
import {
  interviewerConfig,
  builderConfig,
  isConfigured,
} from "@cr/llm";
import { readTree, readFile, writeFile } from "./fileApi.js";
import { applySourceEdit } from "./editService.js";
import { interviewTurn, finalizeSpec, type AppSpec } from "./interview.js";
import { buildApp } from "./build.js";
import { aiEdit } from "./aiEdit.js";
import { runAI } from "./ai.js";
import { proxyFetch } from "./proxy.js";
import { generateImage, textToSpeech, transcribe, embed } from "./deepinfra.js";
import { indexDoc, ragQuery } from "./rag.js";
import { Hub } from "./wsHub.js";
import { ProjectSocket } from "./projectSocket.js";
import { PROJECT_ROOT } from "./projectRoot.js";
import { view as historyView, undo, redo, restoreTo } from "./history.js";
import {
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  transferProjects,
  createProject,
  getProject,
  listProjects,
  updateProject,
  listMessages,
  type Conversation,
  type Project,
} from "./store.js";
import {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  guestEmail,
  userIdFromRequest,
  requireAuth,
} from "./auth.js";
import { suggestIdeas, type SuggestInput } from "./ideas.js";
import { legalDocs } from "./legalDocs.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

app.get("/api/health", async () => ({ ok: true, projectRoot: PROJECT_ROOT }));

/* ============================== auth (funnel) ============================== */

// Guest-first: mint a throwaway account so the funnel works before sign-up.
app.post("/auth/guest", async () => {
  const user = createUser({ email: guestEmail(), isGuest: true });
  return { token: signToken(user.id), user: { email: user.email } };
});

// Claim: turn the current guest into a real account (or create one fresh).
app.post<{ Body: { email?: string; password?: string } }>(
  "/auth/claim",
  async (req, reply) => {
    const { email, password } = req.body ?? {};
    if (!email || !email.includes("@") || !password || password.length < 6) {
      return reply
        .code(400)
        .send({ error: "valid email and 6+ char password required" });
    }
    if (getUserByEmail(email)) {
      return reply.code(409).send({ error: "Email already in use" });
    }
    const { hash, salt } = hashPassword(password);
    const uid = userIdFromRequest(req);
    const guest = uid ? getUser(uid) : undefined;
    const user =
      guest && guest.isGuest
        ? updateUser(uid!, {
            email,
            passwordHash: hash,
            salt,
            isGuest: false,
          })!
        : createUser({ email, passwordHash: hash, salt, isGuest: false });
    return { token: signToken(user.id), user: { email: user.email } };
  },
);

// Login: authenticate, and fold any guest's projects into the real account.
app.post<{
  Body: {
    email?: string;
    password?: string;
    guestToken?: string;
    transferProjectId?: string;
  };
}>("/auth/login", async (req, reply) => {
  const { email, password, guestToken } = req.body ?? {};
  const user = email ? getUserByEmail(email) : undefined;
  if (!user || !password || !verifyPassword(user, password)) {
    return reply.code(401).send({ error: "Invalid email or password" });
  }
  const guestId = verifyToken(guestToken);
  if (guestId && guestId !== user.id) {
    const guest = getUser(guestId);
    if (guest?.isGuest) transferProjects(guestId, user.id);
  }
  return { token: signToken(user.id), user: { email: user.email } };
});

/* =============================== ideas ==================================== */

app.post<{ Body: SuggestInput }>(
  "/ideas/suggest",
  { preHandler: requireAuth },
  async (req) => {
    const body = req.body ?? ({} as SuggestInput);
    return suggestIdeas({
      mode: body.mode ?? "random",
      seed: body.seed,
      basedOn: body.basedOn,
    });
  },
);

/* ============================== projects =================================== */

/** Fetch a project the caller owns, or send the right error and return null. */
function ownedProject(
  req: import("fastify").FastifyRequest,
  reply: import("fastify").FastifyReply,
  projectId: string,
): Project | null {
  const project = getProject(projectId);
  if (!project) {
    reply.code(404).send({ error: "project not found" });
    return null;
  }
  if (project.userId !== req.userId) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return project;
}

app.get("/projects", { preHandler: requireAuth }, async (req) => {
  return listProjects(req.userId!);
});

app.post<{ Body: { name?: string } }>(
  "/projects",
  { preHandler: requireAuth },
  async (req) => {
    return createProject(req.userId!, req.body?.name ?? "New app");
  },
);

app.get<{ Params: { id: string } }>(
  "/projects/:id",
  { preHandler: requireAuth },
  async (req, reply) => {
    return ownedProject(req, reply, req.params.id) ?? undefined;
  },
);

// Simulated $1 one-time payment — just stamps paidAt (no real charge).
app.post<{ Params: { id: string } }>(
  "/projects/:id/pay",
  { preHandler: requireAuth },
  async (req, reply) => {
    const project = ownedProject(req, reply, req.params.id);
    if (!project) return;
    return updateProject(project.id, { paidAt: Date.now() });
  },
);

// Make sure the project has a spec (extract one if the interview didn't finish).
app.post<{ Params: { id: string } }>(
  "/projects/:id/spec/ensure",
  { preHandler: requireAuth },
  async (req, reply) => {
    const project = ownedProject(req, reply, req.params.id);
    if (!project) return;
    if (project.spec) return { spec: project.spec };
    const history = listMessages(project.id, "interview").map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const spec = await finalizeSpec(history, project.name);
    const updated = updateProject(project.id, {
      spec,
      name: spec.name || project.name,
      status: project.status === "draft" ? "spec_ready" : project.status,
    });
    return { spec: updated?.spec };
  },
);

// The app's tailored Privacy / Terms / Support docs. Available before the build
// (computed from the spec) so the IDE can show "included, click to view".
app.get<{ Params: { id: string } }>(
  "/projects/:id/docs",
  { preHandler: requireAuth },
  async (req, reply) => {
    const project = ownedProject(req, reply, req.params.id);
    if (!project) return;
    const appName = project.spec?.name || project.name || "your app";
    return legalDocs({
      appName,
      // Capabilities aren't known until the architect runs; pre-build docs use a
      // generic data-collection clause. The on-device screens use the real set.
      capabilities: [],
      description: project.spec?.description,
    });
  },
);

app.get<{ Params: { id: string }; Querystring: { kind?: string } }>(
  "/projects/:id/messages",
  { preHandler: requireAuth },
  async (req, reply) => {
    const project = ownedProject(req, reply, req.params.id);
    if (!project) return;
    const kind = req.query.kind as Conversation | undefined;
    return listMessages(project.id, kind).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      conversation: m.conversation,
      ts: m.ts,
    }));
  },
);

app.get("/api/files", async () => ({ tree: await readTree() }));

app.get<{ Querystring: { path: string } }>("/api/file", async (req, reply) => {
  const p = req.query.path;
  if (!p) return reply.code(400).send({ error: "missing ?path" });
  try {
    return { path: p, content: await readFile(p) };
  } catch (e: any) {
    return reply.code(404).send({ error: e.message });
  }
});

app.post<{ Body: { path: string; content: string } }>(
  "/api/file",
  async (req, reply) => {
    const { path: p, content } = req.body ?? ({} as any);
    if (!p || content == null)
      return reply.code(400).send({ error: "path and content required" });
    try {
      await writeFile(p, content);
      return { ok: true };
    } catch (e: any) {
      return reply.code(400).send({ error: e.message });
    }
  },
);

app.post<{ Body: EditRequest }>("/api/edit", async (req, reply) => {
  const result = await applySourceEdit(req.body);
  if (!result.ok) return reply.code(422).send(result);
  return result;
});

/* ------------------------------ edit history ------------------------------- */

// The undo/redo timeline (snapshots stripped) + the current cursor.
app.get("/api/history", async () => historyView());

app.post("/api/history/undo", async (_req, reply) => {
  const r = await undo();
  if (!r.ok) return reply.code(409).send(r);
  return { ...r, view: historyView() };
});

app.post("/api/history/redo", async (_req, reply) => {
  const r = await redo();
  if (!r.ok) return reply.code(409).send(r);
  return { ...r, view: historyView() };
});

// Jump straight to any point in the timeline. `index` is -1 (initial) .. n-1.
app.post<{ Body: { index: number } }>(
  "/api/history/restore",
  async (req, reply) => {
    const index = req.body?.index;
    if (typeof index !== "number")
      return reply.code(400).send({ error: "index (number) required" });
    const r = await restoreTo(index);
    if (!r.ok) return reply.code(409).send(r);
    return { ...r, view: historyView() };
  },
);

/* ------------------------------- AI funnel --------------------------------- */

// Report which AI brains are configured (so the UI can guide setup).
app.get("/api/ai/status", async () => ({
  interviewer: isConfigured(interviewerConfig()),
  builder: isConfigured(builderConfig()),
}));

// One adaptive interview turn (Qwen).
app.post<{ Body: { messages: ChatMessage[] } }>(
  "/api/interview",
  async (req, reply) => {
    try {
      return await interviewTurn(req.body?.messages ?? []);
    } catch (e: any) {
      return reply.code(502).send({ error: e.message });
    }
  },
);

// Build the app from the spec (or a raw idea) (MiniMax).
app.post<{ Body: { spec?: AppSpec; idea?: string } }>(
  "/api/build",
  async (req, reply) => {
    const result = await buildApp(req.body ?? {});
    if (!result.ok) return reply.code(502).send(result);
    return result;
  },
);

// Free-form natural-language edit at a tapped location (MiniMax).
app.post<{ Body: { source: SourceLocation; instruction: string } }>(
  "/api/ai-edit",
  async (req, reply) => {
    const { source, instruction } = req.body ?? ({} as any);
    if (!source || !instruction)
      return reply.code(400).send({ error: "source and instruction required" });
    const result = await aiEdit({ source, instruction });
    if (!result.ok) return reply.code(502).send(result);
    return result;
  },
);

// ── Runtime hub for GENERATED apps: AI + a guarded external-fetch proxy ──
app.post<{ Body: { prompt?: string; image?: string } }>(
  "/api/ai",
  async (req, reply) => {
    const { prompt, image } = req.body ?? {};
    if (!prompt) return reply.code(400).send({ ok: false, error: "prompt required" });
    const result = await runAI({ prompt, imageDataUrl: image });
    if (!result.ok) return reply.code(502).send(result);
    return result;
  },
);

app.post<{
  Body: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
}>("/api/fetch", async (req, reply) => {
  const { url, method, headers, body } = req.body ?? {};
  if (!url) return reply.code(400).send({ ok: false, error: "url required" });
  const result = await proxyFetch({ url, method, headers, body });
  if (!result.ok && result.error && result.status == null)
    return reply.code(400).send(result);
  return result;
});

// Image generation (Seedream), TTS (Kokoro), STT (Whisper), embeddings (Qwen3).
app.post<{ Body: { prompt?: string } }>("/api/image", async (req, reply) => {
  const { prompt } = req.body ?? {};
  if (!prompt) return reply.code(400).send({ ok: false, error: "prompt required" });
  const r = await generateImage(prompt);
  if (!r.ok) return reply.code(502).send(r);
  return r;
});

app.post<{ Body: { text?: string } }>("/api/tts", async (req, reply) => {
  const { text } = req.body ?? {};
  if (!text) return reply.code(400).send({ ok: false, error: "text required" });
  const r = await textToSpeech(text);
  if (!r.ok) return reply.code(502).send(r);
  return r;
});

app.post<{ Body: { audio?: string } }>("/api/stt", async (req, reply) => {
  const { audio } = req.body ?? {};
  if (!audio) return reply.code(400).send({ ok: false, error: "audio required" });
  const r = await transcribe(audio);
  if (!r.ok) return reply.code(502).send(r);
  return r;
});

app.post<{ Body: { input?: string[] } }>("/api/embed", async (req, reply) => {
  const { input } = req.body ?? {};
  if (!input?.length) return reply.code(400).send({ ok: false, error: "input required" });
  const r = await embed(input);
  if (!r.ok) return reply.code(502).send(r);
  return r;
});

// RAG: index a document, and ask grounded questions — scoped per app by appId.
app.post<{ Body: { content?: string; appId?: string } }>(
  "/api/rag/index",
  async (req, reply) => {
    const { content, appId } = req.body ?? {};
    if (!content) return reply.code(400).send({ ok: false, error: "content required" });
    const r = await indexDoc(content, appId || "default");
    if (!r.ok) return reply.code(502).send(r);
    return r;
  },
);

app.post<{ Body: { question?: string; appId?: string } }>(
  "/api/rag/query",
  async (req, reply) => {
    const { question, appId } = req.body ?? {};
    if (!question) return reply.code(400).send({ ok: false, error: "question required" });
    const r = await ragQuery(question, appId || "default");
    if (!r.ok) return reply.code(502).send(r);
    return r;
  },
);

const server = await app.listen({ port: PORT, host: HOST });

// One HTTP server, two WS planes: the tap-to-edit relay Hub (/, /ide and /app)
// and the per-project funnel socket (/ws). Route raw upgrades by path. The
// preview runtime connects to /app and the IDE to /ide; the Hub tells them apart
// by whether the path starts with /ide.
const hub = new Hub();
const projectSocket = new ProjectSocket();
app.server.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url || "", "http://localhost").pathname;
  if (pathname === "/ws") projectSocket.handleUpgrade(req, socket, head);
  else if (pathname === "/ide" || pathname === "/app" || pathname === "/")
    hub.handleUpgrade(req, socket, head);
  else socket.destroy();
});

console.log(`[backend] listening on ${server}`);
console.log(`[backend] editing project at ${PROJECT_ROOT}`);
