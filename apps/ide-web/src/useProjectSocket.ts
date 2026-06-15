import { useCallback, useEffect, useRef, useState } from "react";
import { wsUrl } from "./api.js";

/**
 * Realtime hook for one project's funnel channel (`/ws`). Mirrors the Appable
 * `useProjectSocket`: it tracks the three chat streams, interview answer chips,
 * the spec, build progress, and the live preview, and lets screens send messages.
 */

export type Conversation = "interview" | "build" | "brainstorm";

export interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface BuildLogEntry {
  id: string;
  text: string;
}

export interface InterviewSuggestions {
  mode: "pick" | "vibe" | "wrapup";
  items: string[];
  step?: number;
  total?: number;
}

export interface Preview {
  webUrl: string;
  expUrl?: string;
}

export interface ProjectSocket {
  connected: boolean;
  interview: Msg[];
  build: Msg[];
  brainstorm: Msg[];
  buildLog: BuildLogEntry[];
  buildProgress: number;
  spec: any;
  projectStatus: string | null;
  interviewSuggestions: InterviewSuggestions | null;
  preview: Preview | null;
  send: (obj: unknown) => void;
  appendLocal: (conversation: Conversation, text: string) => void;
  seed: (conversation: Conversation, msgs: Msg[]) => void;
}

let localSeq = 0;

export function useProjectSocket(projectId: string): ProjectSocket {
  const [connected, setConnected] = useState(false);
  const [interview, setInterview] = useState<Msg[]>([]);
  const [build, setBuild] = useState<Msg[]>([]);
  const [brainstorm, setBrainstorm] = useState<Msg[]>([]);
  const [buildLog, setBuildLog] = useState<BuildLogEntry[]>([]);
  const [buildProgress, setBuildProgress] = useState(0);
  const [spec, setSpec] = useState<any>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [interviewSuggestions, setInterviewSuggestions] =
    useState<InterviewSuggestions | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const setFor = useCallback(
    (conversation: Conversation, fn: (prev: Msg[]) => Msg[]) => {
      if (conversation === "interview") setInterview(fn);
      else if (conversation === "build") setBuild(fn);
      else setBrainstorm(fn);
    },
    [],
  );

  useEffect(() => {
    if (!projectId) return;
    let closed = false;
    let retry: any;

    const connect = () => {
      const ws = new WebSocket(wsUrl(projectId));
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "hello":
            setProjectStatus(msg.status ?? null);
            if (msg.spec) setSpec(msg.spec);
            if (msg.preview) setPreview(msg.preview);
            break;
          case "message": {
            const m = msg.message;
            setFor(msg.conversation, (prev) =>
              prev.some((x) => x.id === m.id)
                ? prev
                : [...prev, { id: m.id, role: m.role, text: m.content }],
            );
            break;
          }
          case "interview.suggestions":
            setInterviewSuggestions(msg.suggestions ?? null);
            break;
          case "spec":
            setSpec(msg.spec);
            break;
          case "status":
            setProjectStatus(msg.status ?? null);
            break;
          case "build.log":
            setBuildLog((prev) => [...prev, msg.entry]);
            break;
          case "build.progress":
            setBuildProgress(msg.progress ?? 0);
            break;
          case "preview":
            setPreview(msg.preview ?? null);
            break;
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(retry);
      wsRef.current?.close();
    };
  }, [projectId, setFor]);

  const send = useCallback((obj: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }, []);

  const appendLocal = useCallback(
    (conversation: Conversation, text: string) => {
      const m: Msg = { id: `local_${++localSeq}`, role: "user", text };
      setFor(conversation, (prev) => [...prev, m]);
    },
    [setFor],
  );

  const seed = useCallback(
    (conversation: Conversation, msgs: Msg[]) => {
      setFor(conversation, () => msgs);
    },
    [setFor],
  );

  return {
    connected,
    interview,
    build,
    brainstorm,
    buildLog,
    buildProgress,
    spec,
    projectStatus,
    interviewSuggestions,
    preview,
    send,
    appendLocal,
    seed,
  };
}
