import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Platform } from "react-native";
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
  /** Whether the preview starts tappable (default true for the builder UX). */
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
  startInEditMode = true,
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
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (!editMode) return;

    const onClick = (e: MouseEvent) => {
      const resolved = resolveElementAtPoint(e.clientX, e.clientY);
      if (!resolved) return; // let untagged clicks through
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

    // Capture phase + pointerdown covers both taps and synthetic RN onPress.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [editMode, send]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {editMode && highlight ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute" as const,
            left: highlight.x,
            top: highlight.y,
            width: highlight.width,
            height: highlight.height,
            borderWidth: 2,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59,130,246,0.12)",
          }}
        />
      ) : null}
    </View>
  );
}

export default TapEditProvider;
