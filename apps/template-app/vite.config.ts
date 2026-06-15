import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * In-browser phone preview, bundled with react-native-web.
 *
 * This renders the SAME React Native source as the native Expo build, but in the
 * browser so tap-to-edit works with zero device setup. Crucially it runs the
 * @cr/babel-plugin-tapsource Babel plugin (same as Metro/babel.config.js) so
 * every element carries __tapSource — the location data the codemod engine edits.
 *
 * Vite's HMR plays the role Metro Fast Refresh plays on device: when the backend
 * rewrites a source file, the preview hot-updates live.
 */
export default defineConfig({
  root: path.resolve(__dirname, "web"),
  plugins: [
    react({
      // Run our source-location plugin through @vitejs/plugin-react's babel pass.
      babel: {
        plugins: [
          [
            "@cr/babel-plugin-tapsource",
            { projectRoot: __dirname, exclude: ["ui/"] },
          ],
        ],
      },
    }),
  ],
  resolve: {
    // The heart of the web preview: RN -> react-native-web, plus web shims for
    // the iOS-native deps so the kit bundles and looks iOS in the browser.
    alias: {
      "react-native": "react-native-web",
      "react-native-safe-area-context": path.resolve(
        __dirname,
        "web-shims/safe-area-context.tsx",
      ),
      "expo-haptics": path.resolve(__dirname, "web-shims/haptics.ts"),
      "expo-blur": path.resolve(__dirname, "web-shims/blur.tsx"),
      "@expo/vector-icons": path.resolve(__dirname, "web-shims/vector-icons.tsx"),
      "expo-linear-gradient": path.resolve(
        __dirname,
        "web-shims/linear-gradient.tsx",
      ),
    },
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".tsx",
      ".ts",
      ".web.jsx",
      ".web.js",
      ".jsx",
      ".js",
    ],
  },
  define: {
    __DEV__: "true",
    "process.env.NODE_ENV": '"development"',
    global: "globalThis",
  },
  server: {
    port: 8081,
    host: true,
    // The IDE embeds this in an <iframe>; allow it.
    cors: true,
  },
});
