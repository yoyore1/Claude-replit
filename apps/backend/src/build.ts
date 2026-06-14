import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import { writeFile } from "./fileApi.js";
import { extractJson, type AppSpec } from "./interview.js";

export interface BuildResult {
  ok: boolean;
  files?: string[];
  error?: string;
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
- No external packages, navigation libraries, or native modules. Simulate multiple screens with useState + conditional rendering or simple tab buttons.
- Valid TypeScript TSX that compiles. Self-contained and visually polished.

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
}): Promise<BuildResult> {
  const userContent = input.spec
    ? `Build this app spec as JSON:\n${JSON.stringify(input.spec, null, 2)}`
    : `Build an app for this idea: ${input.idea ?? "a simple starter app"}`;

  let raw: string;
  try {
    raw = await chat(builderConfig(), {
      messages: [SYSTEM, { role: "user", content: userContent }],
      temperature: 0.4,
      maxTokens: 4000,
    });
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const parsed = extractJson<{ files: Record<string, string> }>(raw);
  if (!parsed?.files || typeof parsed.files !== "object") {
    return { ok: false, error: "Builder did not return a files object", raw };
  }

  // The entry must exist and export a default App. The TapEditProvider wrapper is
  // applied by the host entry (web/main.tsx, index.js), and the __tapSource babel
  // plugin tags every element automatically — so any valid App is tap-editable.
  const appSrc = parsed.files["App.tsx"];
  if (typeof appSrc !== "string") {
    return { ok: false, error: "Builder did not produce App.tsx", raw };
  }
  if (!/export\s+default\s/.test(appSrc)) {
    return { ok: false, error: "App.tsx must have a default export", raw };
  }

  const written: string[] = [];
  for (const [rel, content] of Object.entries(parsed.files)) {
    if (typeof content !== "string") continue;
    if (!/\.(tsx?|jsx?|json)$/.test(rel)) {
      return { ok: false, error: `Refusing to write non-source file: ${rel}`, raw };
    }
    // Validate it parses before writing so we never break the preview bundler.
    if (/\.(tsx?|jsx?)$/.test(rel)) {
      try {
        parse(content);
      } catch (e: any) {
        return {
          ok: false,
          error: `Generated ${rel} is not valid: ${e.message}`,
          raw,
        };
      }
    }
    try {
      await writeFile(rel, content);
      written.push(rel);
    } catch (e: any) {
      return { ok: false, error: `Cannot write ${rel}: ${e.message}`, raw };
    }
  }

  if (written.length === 0) {
    return { ok: false, error: "No files were generated", raw };
  }
  return { ok: true, files: written };
}
