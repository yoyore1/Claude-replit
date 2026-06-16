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

// Virtual / VPN adapters whose IPs a phone on the Wi-Fi can't reach. We must
// pick the real LAN address (e.g. the Wi-Fi/Ethernet 192.168.x.x), not a VPN
// (NordLynx/OpenVPN), WSL, or VM adapter — otherwise Expo Go times out.
const VIRTUAL_IF =
  /(WSL|vEthernet|VirtualBox|VMware|Hyper-V|NordLynx|OpenVPN|TAP|Tunnel|Loopback|Hamachi|ZeroTier|Radmin|utun|tailscale)/i;

function getLanIp(): string | null {
  // Explicit override always wins (set EXPO_HOST=192.168.x.x if detection fails).
  if (process.env.EXPO_HOST) return process.env.EXPO_HOST;
  const candidates: { addr: string; score: number }[] = [];
  for (const [name, nets] of Object.entries(networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family !== "IPv4" || net.internal) continue;
      if (net.address.startsWith("169.254.")) continue; // link-local (no network)
      let score = 0;
      if (net.address.startsWith("192.168.")) score += 100; // typical home LAN
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(net.address)) score += 50;
      else if (net.address.startsWith("10.")) score += 30;
      if (VIRTUAL_IF.test(name)) score -= 80; // strongly deprioritize VPN/VM/WSL
      candidates.push({ addr: net.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.addr ?? null;
}

const LAN_IP = getLanIp();
// The web preview (react-native-web via Vite) and the Expo/Metro dev server for
// real devices live on different ports — Metro defaults to 8082 because Vite
// holds 8081.
const WEB_PORT = process.env.PREVIEW_WEB_PORT || "8081";
const METRO_PORT = process.env.METRO_PORT || process.env.EXPO_PORT || "8082";
const PREVIEW_WEB_URL =
  process.env.PREVIEW_WEB_URL ||
  (LAN_IP ? `http://${LAN_IP}:${WEB_PORT}` : `http://localhost:${WEB_PORT}`);
const EXPO_URL =
  process.env.EXPO_URL ||
  (LAN_IP ? `exp://${LAN_IP}:${METRO_PORT}` : "");

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
      // Pin the progress to a fixed length and derive the step from how many
      // answers we've taken — the model's own n/m can wobble (it decides how many
      // questions to ask on the fly).
      const INTERVIEW_STEPS = 4;
      const answered = this.historyFor(projectId, "interview").filter(
        (m) => m.role === "user",
      ).length;
      this.broadcast(projectId, {
        type: "interview.suggestions",
        suggestions: {
          mode: turn.suggestionMode ?? "pick",
          items: turn.suggestions ?? [],
          step: Math.min(answered, INTERVIEW_STEPS),
          total: INTERVIEW_STEPS,
          pick: turn.appablePick,
          swatches: turn.swatches,
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

    const res = await buildApp({
      projectId,
      spec: project.spec ?? undefined,
      idea: project.spec ? undefined : project.name,
      onProgress: (pct, label) => this.log(projectId, label, pct),
    });

    if (res.ok) {
      updateProject(projectId, { status: "running", preview: this.preview() });
      this.broadcast(projectId, { type: "status", status: "running" });
      this.broadcast(projectId, { type: "preview", preview: this.preview() });
      if (res.addedExtras?.length)
        this.reply(
          projectId,
          "build",
          `I also added ${res.addedExtras.join(", ")} — things a great version of this app usually needs.`,
        );
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
