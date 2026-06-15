import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import { writeFile } from "./fileApi.js";
import { extractJson, type AppSpec } from "./interview.js";
import { IOS_FEEL_PROMPT, auditIosFeel } from "./iosFeel.js";
import { reset as resetHistory } from "./history.js";
import { seedFromBuild } from "./projectFiles.js";

export interface BuildResult {
  ok: boolean;
  files?: string[];
  error?: string;
  /** Non-fatal iOS-feel audit notes (Android-isms etc.). */
  warnings?: string[];
  /** The raw model output, kept for debugging when parsing fails. */
  raw?: string;
}

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You are a senior React Native engineer building inside a visual editor where the user
edits the running app by TAPPING elements. The code you write MUST be tap-to-edit friendly.

OUTPUT FORMAT: respond with ONLY a JSON object, no markdown, of the shape:
{"files": {"App.tsx": "<full file contents>"}}

Hard requirements for App.tsx:
- import React, { useState } from "react";
- import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
- export default function App() returning the screen UI. (The tap-to-edit wrapper is
  added by the host automatically — do NOT import or use TapEditProvider yourself.)
- ONLY use these RN components: View, Text, ScrollView, Pressable, Image. Images use {{ uri: "https://..." }}.
- No external packages or native modules beyond the kit below. Simulate multiple screens with useState + conditional rendering or simple tab buttons.
- Valid TypeScript TSX that compiles. Self-contained and visually polished.

${IOS_FEEL_PROMPT}

TAP-TO-EDIT RULES (critical — follow exactly so editing works):
- Put visible text as PLAIN literal text directly inside <Text>Hello</Text>. Do NOT build label
  text from variables, props, template strings, or .map() when it is static copy — the editor
  rewrites the literal JSX text node.
- Define styles with StyleSheet.create({ ... }) and give each element a named style. Put colors as
  explicit literals: color: "#rrggbb" and backgroundColor: "#rrggbb". Avoid computing colors at runtime.
- Prefer one style object per element (style={styles.x}) or an inline object literal; the editor edits
  the color key in that object or the referenced StyleSheet entry.
- Keep each element's opening tag on enough lines that elements are distinct (no giant one-liners).`,
};

/** Generate the app's source from a spec (or free-text idea) and write it. */
export async function buildApp(input: {
  spec?: AppSpec;
  idea?: string;
  /** When set, the built files are also stashed in this project's store. */
  projectId?: string;
}): Promise<BuildResult> {
  const userContent = input.spec
    ? `Build this app spec as JSON:\n${JSON.stringify(input.spec, null, 2)}`
    : `Build an app for this idea: ${input.idea ?? "a simple starter app"}`;

  const messages: ChatMessage[] = [
    SYSTEM,
    { role: "user", content: userContent },
  ];

  // The builder (MiniMax) is a reasoning model: it occasionally returns empty
  // content or truncated JSON when its "thinking" eats the token budget. Those
  // failures are transient, so retry the generate+validate step a couple times
  // before giving up. We only WRITE once a full, valid file set is in hand.
  const MAX_ATTEMPTS = 3;
  let lastError = "";
  let lastRaw = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await chat(builderConfig(), {
        messages,
        temperature: 0.4,
        maxTokens: 30000,
      });
    } catch (e: any) {
      lastError = e.message; // e.g. empty content / network blip — retry
      continue;
    }
    lastRaw = raw;

    const parsed = extractJson<{ files: Record<string, string> }>(raw);
    if (!parsed?.files || typeof parsed.files !== "object") {
      lastError = "Builder did not return a files object"; // truncated JSON — retry
      continue;
    }

    // The entry must exist and export a default App. The TapEditProvider wrapper
    // is applied by the host entry (web/main.tsx, index.js), and the __tapSource
    // babel plugin tags every element — so any valid App is tap-editable.
    const appSrc = parsed.files["App.tsx"];
    if (typeof appSrc !== "string") {
      lastError = "Builder did not produce App.tsx";
      continue;
    }
    if (!/export\s+default\s/.test(appSrc)) {
      lastError = "App.tsx must have a default export";
      continue;
    }

    // Validate EVERY source file parses before writing anything, so a partial or
    // malformed generation never half-writes the project or breaks the bundler.
    let invalid = "";
    for (const [rel, content] of Object.entries(parsed.files)) {
      if (typeof content !== "string") continue;
      if (!/\.(tsx?|jsx?|json)$/.test(rel)) {
        invalid = `non-source file: ${rel}`;
        break;
      }
      if (/\.(tsx?|jsx?)$/.test(rel)) {
        try {
          parse(content);
        } catch (e: any) {
          invalid = `${rel} is not valid: ${e.message}`;
          break;
        }
      }
    }
    if (invalid) {
      lastError = `Generated ${invalid}`; // bad generation — retry
      continue;
    }

    // Validation passed — now write the whole set.
    const written: string[] = [];
    for (const [rel, content] of Object.entries(parsed.files)) {
      if (typeof content !== "string") continue;
      try {
        await writeFile(rel, content);
        written.push(rel);
      } catch (e: any) {
        // A filesystem error is not the model's fault — don't retry it.
        return { ok: false, error: `Cannot write ${rel}: ${e.message}`, raw };
      }
    }
    if (written.length === 0) {
      lastError = "No files were generated";
      continue;
    }
    // Fresh app → fresh undo timeline (the built app is the "initial" state).
    resetHistory();
    // Stash the generated files in the project's store + mark it the live one.
    if (input.projectId) {
      const fileMap: Record<string, string> = {};
      for (const rel of written) fileMap[rel] = parsed.files[rel];
      try {
        await seedFromBuild(input.projectId, fileMap);
      } catch {
        /* store failure shouldn't fail the build itself */
      }
    }
    // Non-fatal audit (no rebuild): surface any Android-isms that slipped through.
    const warnings = auditIosFeel(appSrc);
    return { ok: true, files: written, warnings };
  }

  return { ok: false, error: lastError || "build failed", raw: lastRaw };
}
