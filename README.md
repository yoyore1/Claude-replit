# Claude-Replit

A Replit-Agent–style builder for **React Native** apps with a **live phone preview**
and **tap-to-edit**: describe an idea, answer a short adaptive interview, get a real
app built, then **tap anything in the preview to change it** — the actual source code
updates and the preview hot-reloads.

```
 Idea  ─►  Interview (Qwen)  ─►  Build (MiniMax)  ─►  Phone preview + Tap-to-edit
                                                      (text & color = instant codemod,
                                                       freeform = AI edit)
```

## Why this is hard (and how it works)

The headline feature is mapping a **tapped element** back to the **exact source
location**, then rewriting the code so the bundler hot-reloads cleanly.

- **Source mapping** — a custom Babel plugin (`@cr/babel-plugin-tapsource`) injects a
  stable `__tapSource={{file,line,col}}` prop onto **every** JSX element. We read our own
  prop at runtime, so we don't depend on React internals (`_debugSource` was removed in
  React 19; the `jsxDEV` source arg in 19.2). Because it runs on every `.tsx` in the
  pipeline, **any** code — hand-written or AI-built — is automatically tap-editable.
- **The wrapper lives in the host** — `<TapEditProvider>` is added by the preview entry
  (`web/main.tsx`, `index.js`), not by the app code. So a generated `App.tsx` only needs to
  be valid TSX with a default export; it can never "forget" to be editable.
- **Selection** — `@cr/tap-edit-runtime` intercepts taps in the running app, finds the
  tapped element's fiber, reads `__tapSource` + current text/colors, and reports it to the
  IDE over WebSocket.
- **Safe edits** — `@cr/codemod` rewrites the source with `recast` (format-preserving AST),
  locating the node by `file:line:col`. Text edits hit the `JSXText` node; **prop edits**
  rewrite a component's string prop (`label`/`title`/…); color edits apply an
  **element-scoped override** (never touching a shared StyleSheet/token). Every result is
  re-parsed before writing, so the bundler's fast-refresh never breaks.
- **Two planes** — selection events travel over WebSocket; source edits travel
  IDE → backend → disk → bundler watcher. Keeping them separate is what protects fast refresh.

## Premium-iOS generation + tap-to-edit on components

Generated apps must feel like native iOS, which is **component-based** (`<SettingsRow
label="…"/>`, `<AppButton title="…"/>`) with colors from **tokens / `PlatformColor`** — so
tap-to-edit has to resolve a tapped element back to the *prop in your screen*, not the kit's
internal `<Text>`.

- **iOS kit** (`apps/template-app/ui/`): `tokens.ts` (Apple type scale, `PlatformColor` with
  web fallbacks, hairline separators, no elevation) + `Screen`, `AppButton`, `GroupedSection`,
  `SettingsRow`, `SegmentedControl`, `SearchField`, `Sheet`, `Icon`, and native-API wrappers
  (`appAlert`/`actionMenu`/`share`). **Web shims** (`web-shims/`) keep `expo-haptics`,
  `expo-blur`, Ionicons and gradients rendering in the react-native-web preview.
- **Prop-aware taps**: kit text is marked with `tapField("label")` → a `data-tap-field`
  attribute. The runtime resolves the tap to the screen-level component instance and edits
  that prop; plain `<Text>literal</Text>` still edits the text node.
- **iOS in the prompts**: `apps/backend/src/iosFeel.ts` injects the design rules into the
  build and AI-edit prompts, plus a fast non-blocking audit for Android-isms.

## Monorepo layout

```
apps/
  ide-web/        React + Vite IDE: build wizard, Monaco editor, file tree, phone preview, tap-to-edit UI
  backend/        Fastify: file API, WebSocket hub, codemod edit service, AI interview/build/edit
  template-app/   The RN app being edited & previewed (react-native-web in-browser; Expo/Metro for device)
packages/
  babel-plugin-tapsource/  injects __tapSource on every JSX element
  tap-edit-runtime/        <TapEditProvider> + fiber inspector + WS client
  codemod/                 recast-based text/color edit engine (unit-tested)
  llm/                     provider-agnostic OpenAI-compatible client (Qwen + MiniMax roles)
  protocol/                shared message/types
```

## Setup

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env   # then fill in keys
```

`.env` (gitignored) — the two AI "brains" are OpenAI-compatible, configured by env:

```
QWEN_API_KEY=...      QWEN_BASE_URL=...    QWEN_MODEL=...     # interview
MINIMAX_API_KEY=...   MINIMAX_BASE_URL=... MINIMAX_MODEL=...  # build + AI edits
```

Without keys the app still runs — the wizard offers "open the starter app", and
deterministic tap-to-edit (text/colors) works fully; only AI interview/build/freeform
edits need keys.

## Run

```bash
pnpm --filter @cr/backend dev          # file API + WS hub + AI routes  :8787
pnpm --filter @cr/template-app web     # phone preview (react-native-web) :8081
pnpm --filter @cr/ide-web dev          # the IDE :5173
```

Open http://localhost:5173 → describe an app → answer the interview → it builds →
tap elements in the preview to edit text/colors, or use “Ask AI to change this”.

## Preview targets

- **In-browser (default):** the template app is bundled with **react-native-web** via Vite,
  framed like a phone. Same RN components, same `__tapSource`, instant HMR — zero device setup.
- **Real device:** the template app is also a valid Expo app (`app.json`, `metro.config.js`,
  `babel.config.js` wire the same plugin into Metro). `pnpm --filter @cr/template-app start`
  runs Expo for a physical phone via Expo Go. (Expo's CLI needs network access to
  `api.expo.dev`; in a locked-down sandbox use the in-browser preview.)

## Tests

```bash
pnpm --filter @cr/codemod test                # text/color codemod (10 cases)
pnpm --filter @cr/babel-plugin-tapsource test # source-location injection (4 cases)
```
