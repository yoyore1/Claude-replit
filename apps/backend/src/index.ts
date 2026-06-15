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
import { interviewTurn, type AppSpec } from "./interview.js";
import { buildApp } from "./build.js";
import { aiEdit } from "./aiEdit.js";
import { Hub } from "./wsHub.js";
import { PROJECT_ROOT } from "./projectRoot.js";
import { view as historyView, undo, redo, restoreTo } from "./history.js";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

app.get("/api/health", async () => ({ ok: true, projectRoot: PROJECT_ROOT }));

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

const server = await app.listen({ port: PORT, host: HOST });
// Attach the websocket hub to the same HTTP server.
new Hub(app.server);

console.log(`[backend] listening on ${server}`);
console.log(`[backend] editing project at ${PROJECT_ROOT}`);
