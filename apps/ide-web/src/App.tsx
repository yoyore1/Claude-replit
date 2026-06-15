import React, { useCallback, useEffect, useState } from "react";
import { Home } from "./screens/Home.js";
import { Interview } from "./screens/Interview.js";
import { SignUp } from "./screens/SignUp.js";
import { Pay } from "./screens/Pay.js";
import { Overview } from "./screens/Overview.js";
import { Build } from "./screens/Build.js";
import { MyApps } from "./screens/MyApps.js";

export type Route =
  | { name: "home" }
  | { name: "interview"; projectId: string; idea?: string }
  | { name: "signup"; projectId: string }
  | { name: "pay"; projectId: string }
  | { name: "overview"; projectId: string }
  | { name: "build"; projectId: string; autostart?: boolean }
  | { name: "apps" };

export type Go = (next: Route) => void;

const ROUTE_KEY = "appable_route";

function loadRoute(): Route {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (raw) return JSON.parse(raw) as Route;
  } catch {
    /* fall through */
  }
  return { name: "home" };
}

export function App() {
  const [route, setRoute] = useState<Route>(loadRoute);

  const go = useCallback<Go>((next) => {
    setRoute(next);
    // Don't persist autostart — a refresh on Build should not rebuild.
    const toSave = next.name === "build" ? { ...next, autostart: false } : next;
    localStorage.setItem(ROUTE_KEY, JSON.stringify(toSave));
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    document.title = "Appable — turn your idea into a real app";
  }, []);

  switch (route.name) {
    case "home":
      return <Home go={go} />;
    case "interview":
      return <Interview go={go} projectId={route.projectId} idea={route.idea} />;
    case "signup":
      return <SignUp go={go} projectId={route.projectId} />;
    case "pay":
      return <Pay go={go} projectId={route.projectId} />;
    case "overview":
      return <Overview go={go} projectId={route.projectId} />;
    case "build":
      return (
        <Build go={go} projectId={route.projectId} autostart={route.autostart} />
      );
    case "apps":
      return <MyApps go={go} />;
  }
}
