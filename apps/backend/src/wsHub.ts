import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";

/**
 * Relay hub between the running preview app and the IDE.
 *
 *   app  --(selection, app-ready)-->  IDE
 *   IDE  --(enter/exit edit mode, overrides)-->  app
 *
 * Source edits do NOT flow through here — they go IDE -> REST -> disk -> Metro,
 * keeping the "selection plane" and "edit plane" separate (protects Fast Refresh).
 *
 * Uses `noServer` so it can share one HTTP server with the project socket: the
 * caller routes `upgrade` events by path and forwards the IDE/app ones here.
 */
export class Hub {
  private wss: WebSocketServer;
  private apps = new Set<WebSocket>();
  private ides = new Set<WebSocket>();

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      const url = req.url || "";
      const isIde = url.startsWith("/ide");
      const group = isIde ? this.ides : this.apps;
      const peers = isIde ? this.apps : this.ides;
      group.add(ws);

      ws.on("message", (data) => {
        const text = data.toString();
        // Relay verbatim to the other side.
        for (const peer of peers) {
          if (peer.readyState === WebSocket.OPEN) peer.send(text);
        }
      });

      ws.on("close", () => group.delete(ws));
      ws.on("error", () => group.delete(ws));
    });
  }

  /** Complete a WS upgrade the caller routed to this hub. */
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit("connection", ws, req);
    });
  }

  /** Push a message to all IDE clients (used after server-side events). */
  broadcastToIde(obj: unknown) {
    const text = JSON.stringify(obj);
    for (const ws of this.ides)
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
  }

  broadcastToApp(obj: unknown) {
    const text = JSON.stringify(obj);
    for (const ws of this.apps)
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
  }
}
