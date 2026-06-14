import { registerRootComponent } from "expo";
import React from "react";
import { TapEditProvider } from "@cr/tap-edit-runtime";
import App from "./App";

// Wrap the app in TapEditProvider at the root so tap-to-edit works on whatever
// App.tsx contains (hand-written or AI-built) without the app code knowing.
function Root() {
  return React.createElement(TapEditProvider, null, React.createElement(App));
}

registerRootComponent(Root);
