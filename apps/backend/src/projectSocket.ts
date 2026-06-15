import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { networkInterfaces } from "node:os";
import { chat, interviewerConfig, type ChatMessage } from "@cr/llm";
import { verifyToken } from "./auth.js";
import {
  getProject,
  addMessage,
  listMessages,
  updateProject,
  type Conversation,
} from "./store.js";
import { activate } from "./projectFiles.js";
import { interviewTurn } from "./interview.js";
import { buildApp } from "./build.js";
import { aiEdit } from "./aiEdit.js";

/**
 * Per-project realtime channel for the consumer funnel (Appable-style).
 *
 * Client connects to `/ws?projectId=<id>&token=<bearer>`. It carries the three
 * chat conversations (interview / build / brainstorm), interview answer chips,
 * the extracted spec, build progress, and the live preview URL. The precise
 * tap-to-edit plane stays on the separate `/ide` Hub + REST `/api/edit`.
 */

function getLanIp(): string | null {
  for (const nets of Object.values(networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const LAN_IP = getLanIp();
const EXPO_PORT = process.env.EXPO_PORT || "8081";
const PREVIEW_WEB_URL =
  process.env.PREVIEW_WEB_URL ||
  (LAN_IP ? `http://${LAN_IP}:${EXPO_PORT}` : `http://localhost:${EXPO_PORT}`);
const EXPO_URL =
  process.env.EXPO_URL ||
  (LAN_IP ? `exp://${LAN_IP}:${EXPO_PORT}` : "");

const BRAINSTORM_SYSTEM: ChatMessage = {
  role: "system",
  content: `You are a friendly product brainstorming partner for someone building a mobile app.
Be concise and encouraging. Suggest features, screens, names, and UX ideas. Plain text only.`,
};

interface Conn {
  ws: WebSocket;
  userId: string;
  projectId: string;
}

export class ProjectSocket {
  private wss: WebSocketServer;
  private rooms = new Map<string, Set<WebSocket>>();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) =>
      this.onConnection(ws, req),
    );
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  private join(projectId: string, ws: WebSocket) {
    let room = this.rooms.get(projectId);
    if (!room) this.rooms.set(projectId, (room = new Set()));
    room.add(ws);
  }

  private leave(projectId: string, ws: WebSocket) {
    const room = this.rooms.get(projectId);
    room?.delete(ws);
    if (room && room.size === 0) this.rooms.delete(projectId);
  }

  /** Send to one socket. */
  private send(ws: WebSocket, obj: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  /** Send to every socket watching a project (multi-tab sync). */
  private broadcast(projectId: string, obj: unknown) {
    const room = this.rooms.get(projectId);
    if (!room) return;
    const text = JSON.stringify(obj);
    for (const ws of room) if (ws.readyState === WebSocket.OPEN) ws.send(text);
  }

  private async onConnection(ws: WebSocket, req: IncomingMessage) {
    const url = new URL(req.url || "", "http://localhost");
    const projectId = url.searchParams.get("projectId") || "";
    const token = url.searchParams.get("token") || "";
    const userId = verifyToken(token);
    const project = projectId ? getProject(projectId) : undefined;

    if (!userId || !project || project.userId !== userId) {
      this.send(ws, { type: "error", error: "unauthorized" });
      ws.close(1008, "unauthorized");
      return;
    }

    const conn: Conn = { ws, userId, projectId };
    this.join(projectId, ws);

    // Make this project the live preview (restore its files if already built).
    try {
      await activate(projectId);
    } catch {
      /* never built yet — nothing to restore */
    }

    const built =
      project.status === "running" || project.status === "sleeping";
    this.send(ws, {
      type: "hello",
      status: project.status,
      spec: project.spec,
      preview: built ? this.preview() : null,
    });

    ws.on("message", (data) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      this.handle(conn, msg).catch((e) =>
        this.send(ws, { type: "error", error: String(e?.message ?? e) }),
      );
    });

    ws.on("close", () => this.leave(projectId, ws));
    ws.on("error", () => this.leave(projectId, ws));
  }

  private preview() {
    return { webUrl: PREVIEW_WEB_URL, expUrl: EXPO_URL || undefined };
  }

  private historyFor(projectId: string, conversation: Conversation): ChatMessage[] {
    return listMessages(projectId, conversation).map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  private async handle(conn: Conn, msg: any) {
    if (msg.type === "chat.send") {
      const conversation = (msg.conversation as Conversation) || "build";
      const text = String(msg.text ?? "").trim();
      if (!text) return;
      if (conversation === "interview") return this.onInterview(conn, text);
      if (conversation === "brainstorm") return this.onBrainstorm(conn, text);
      return this.onBuildChat(conn, text);
    }
    if (msg.type === "build.start") {
      return this.onBuildStart(conn);
    }
  }

  /** Emit an assistant message: persist + push to the room. */
  private reply(projectId: string, conversation: Conversation, content: string) {
    const m = addMessage({ projectId, conversation, role: "assistant", content });
    this.broadcast(projectId, {
      type: "message",
      conversation,
      message: { id: m.id, role: m.role, content: m.content, ts: m.ts },
    });
  }

  private async onInterview(conn: Conn, text: string) {
    const { projectId } = conn;
    addMessage({ projectId, conversation: "interview", role: "user", content: text });
    const turn = await interviewTurn(this.historyFor(projectId, "interview"));
    this.reply(projectId, "interview", turn.reply);

    if (turn.done) {
      const patch = turn.spec
        ? { spec: turn.spec, name: turn.spec.name, status: "spec_ready" as const }
        : { status: "spec_ready" as const };
      updateProject(projectId, patch);
      if (turn.spec) this.broadcast(projectId, { type: "spec", spec: turn.spec });
      this.broadcast(projectId, { type: "status", status: "spec_ready" });
      this.broadcast(projectId, {
        type: "interview.suggestions",
        suggestions: { mode: "wrapup", items: [] },
      });
    } else {
      this.broadcast(projectId, {
        type: "interview.suggestions",
        suggestions: {
          mode: turn.suggestionMode ?? "pick",
          items: turn.suggestions ?? [],
          step: turn.step,
          total: turn.total,
        },
      });
    }
  }

  private async onBrainstorm(conn: Conn, text: string) {
    const { projectId } = conn;
    addMessage({ projectId, conversation: "brainstorm", role: "user", content: text });
    let reply = "Let me think about that…";
    try {
      reply = await chat(interviewerConfig(), {
        messages: [BRAINSTORM_SYSTEM, ...this.historyFor(projectId, "brainstorm")],
        temperature: 0.8,
        maxTokens: 600,
      });
    } catch (e: any) {
      reply = `Brainstorm is unavailable right now (${e.message}).`;
    }
    this.reply(projectId, "brainstorm", reply.trim());
  }

  /** Build-tab chat applies a whole-file natural-language edit to App.tsx. */
  private async onBuildChat(conn: Conn, text: string) {
    const { projectId } = conn;
    addMessage({ projectId, conversation: "build", role: "user", content: text });
    const res = await aiEdit({
      source: { file: "App.tsx", line: 1, col: 1 },
      instruction: text,
    });
    const reply = res.ok
      ? "Done — I updated your app. Check the preview."
      : `I couldn't apply that change: ${res.error}`;
    this.reply(projectId, "build", reply);
  }

  private log(projectId: string, text: string, progress?: number) {
    this.broadcast(projectId, {
      type: "build.log",
      entry: { id: `l${Date.now()}_${Math.round((progress ?? 0) * 100)}`, text },
    });
    if (typeof progress === "number")
      this.broadcast(projectId, { type: "build.progress", progress });
  }

  private async onBuildStart(conn: Conn) {
    const { projectId } = conn;
    const project = getProject(projectId);
    if (!project) return;

    updateProject(projectId, { status: "building" });
    this.broadcast(projectId, { type: "status", status: "building" });
    this.log(projectId, "Starting build…", 5);
    this.log(projectId, "Designing your screens with AI…", 25);

    const res = await buildApp({
      projectId,
      spec: project.spec ?? undefined,
      idea: project.spec ? undefined : project.name,
    });

    if (res.ok) {
      this.log(projectId, "Writing source files…", 80);
      updateProject(projectId, { status: "running", preview: this.preview() });
      this.log(projectId, "Your app is live!", 100);
      this.broadcast(projectId, { type: "status", status: "running" });
      this.broadcast(projectId, { type: "preview", preview: this.preview() });
      if (res.warnings?.length)
        this.log(projectId, `Notes: ${res.warnings.join(", ")}`);
      this.reply(
        projectId,
        "build",
        "Your app is live in the preview — tap any element to edit it, or tell me what to change.",
      );
    } else {
      updateProject(projectId, { status: "error" });
      this.broadcast(projectId, { type: "status", status: "error" });
      this.log(projectId, `Build failed: ${res.error}`, 100);
      this.reply(projectId, "build", `The build failed: ${res.error}`);
    }
  }
}
