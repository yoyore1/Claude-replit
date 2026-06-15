import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, Platform } from "react-native";
import {
  makeElementId,
  type AppToIdeMessage,
  type IdeToAppMessage,
} from "@cr/protocol";
import { resolveElementAtPoint, type ResolvedElement } from "./fiber.js";

export { tapField } from "./tapField.js";

export interface TapEditProviderProps {
  children: React.ReactNode;
  /** WebSocket URL of the backend hub's app channel. */
  wsUrl?: string;
  /** Whether the preview starts tappable (default false: the app is interactive
   *  until the user turns tap-to-edit on). */
  startInEditMode?: boolean;
}

const DEFAULT_WS =
  (typeof process !== "undefined" &&
    (process.env as any)?.EXPO_PUBLIC_TAP_WS_URL) ||
  "ws://localhost:8787/app";

/**
 * Mount this once at the app root. It:
 *  - connects to the backend hub and announces tap-to-edit availability,
 *  - intercepts taps (capture phase on web) and reports the tapped element's
 *    source location + current text/color to the IDE,
 *  - draws a highlight box over the current selection.
 *
 * It never writes files and never mutates app code at runtime, so Metro Fast
 * Refresh is unaffected.
 */
export function TapEditProvider({
  children,
  wsUrl = DEFAULT_WS,
  startInEditMode = false,
}: TapEditProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [editMode, setEditMode] = useState(startInEditMode);
  const [highlight, setHighlight] =
    useState<ResolvedElement["rect"] | null>(null);

  const send = useCallback((msg: AppToIdeMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // Connect (with simple auto-reconnect).
  useEffect(() => {
    let closed = false;
    let retry: any;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        retry = setTimeout(connect, 1500);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => send({ type: "app-ready", tagging: true });
      ws.onmessage = (ev) => {
        let msg: IdeToAppMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.type === "enter-edit-mode") setEditMode(true);
        else if (msg.type === "exit-edit-mode") {
          setEditMode(false);
          setHighlight(null);
        }
      };
      ws.onclose = () => {
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
  }, [wsUrl, send]);

  // Web: capture-phase tap interception so the app's own handlers don't fire.
  //
  // It's not enough to swallow `click`: react-native-web's Pressable drives its
  // press/responder off the EARLIER mousedown/mouseup/touchstart/touchend events
  // and fires onPress (the app's navigation) from that sequence — before the
  // click we used to block. So we intercept the whole press gesture in capture
  // phase: select on the press-initiating event, and swallow the follow-ups so
  // RNW never completes a press.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!editMode) return;

    // A resolution failure must never bubble up and crash the app.
    const resolveAt = (x: number, y: number) => {
      try {
        return resolveElementAtPoint(x, y);
      } catch (err) {
        console.warn("[tap-edit] could not resolve element:", err);
        return null;
      }
    };

    const pointOf = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
      if ("touches" in e) {
        const t = e.touches[0] ?? e.changedTouches[0];
        return t ? { x: t.clientX, y: t.clientY } : null;
      }
      return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    // Press-initiating events: resolve + select, then swallow.
    const onDown = (e: MouseEvent | TouchEvent) => {
      const p = pointOf(e);
      if (!p) return;
      const resolved = resolveAt(p.x, p.y);
      if (!resolved) return; // untagged: let the app handle it (back button, etc.)
      e.preventDefault();
      e.stopPropagation();
      setHighlight(resolved.rect);
      send({
        type: "selection",
        selection: {
          elementId: makeElementId(resolved.source),
          source: resolved.source,
          componentName: resolved.componentName,
          currentText: resolved.currentText,
          field: resolved.field,
          currentStyle: resolved.currentStyle,
        },
      });
    };

    // Follow-up events: just block over a tagged element so RNW can't complete
    // the press / fire onPress / navigate.
    const onBlock = (e: MouseEvent | TouchEvent) => {
      const p = pointOf(e);
      if (!p) return;
      if (!resolveAt(p.x, p.y)) return; // untagged: pass through
      e.preventDefault();
      e.stopPropagation();
    };

    const downEvents: (keyof DocumentEventMap)[] = ["mousedown", "touchstart"];
    const blockEvents: (keyof DocumentEventMap)[] = [
      "mouseup",
      "touchend",
      "click",
    ];
    for (const t of downEvents) document.addEventListener(t, onDown as any, true);
    for (const t of blockEvents) document.addEventListener(t, onBlock as any, true);
    return () => {
      for (const t of downEvents)
        document.removeEventListener(t, onDown as any, true);
      for (const t of blockEvents)
        document.removeEventListener(t, onBlock as any, true);
    };
  }, [editMode, send]);

  const finite = (n: any) => typeof n === "number" && Number.isFinite(n);
  const showHighlight =
    editMode &&
    highlight &&
    finite(highlight.x) &&
    finite(highlight.y) &&
    finite(highlight.width) &&
    finite(highlight.height);

  return (
    <View style={{ flex: 1 }}>
      <AppErrorBoundary>{children}</AppErrorBoundary>
      {showHighlight ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute" as const,
            left: highlight!.x,
            top: highlight!.y,
            width: highlight!.width,
            height: highlight!.height,
            borderWidth: 2,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.12)",
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * Keeps a buggy app screen from blanking the whole preview to black. A render
 * error here shows a readable message (and the reason) instead of an empty void,
 * so the builder can see what broke and ask for a fix. Crucial because screens
 * are AI-generated and may occasionally throw.
 */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[tap-edit] app render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 28,
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#1c1c1e", textAlign: "center" }}>
            This screen hit an error
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13, color: "#8a8a8e", textAlign: "center" }}>
            {this.state.error.message}
          </Text>
          <Text style={{ marginTop: 14, fontSize: 13, color: "#8a8a8e", textAlign: "center" }}>
            Ask for a change in the chat to fix it.
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export default TapEditProvider;
