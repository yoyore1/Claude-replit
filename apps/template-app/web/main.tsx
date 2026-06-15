import React from "react";
import { createRoot } from "react-dom/client";
import { TapEditProvider } from "@cr/tap-edit-runtime";
import App from "../App";

// The harness wraps the app in TapEditProvider, so ANY App (hand-written or
// AI-built) is tap-editable without having to remember the wrapper. The
// __tapSource babel plugin tags every element regardless.
const root = document.getElementById("root")!;
createRoot(root).render(
  <TapEditProvider>
    <App />
  </TapEditProvider>,
);
