import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import { writeFile } from "./fileApi.js";
import { extractJson, type AppSpec } from "./interview.js";
import { IOS_FEEL_PROMPT, SCREEN_CONTRACT, auditIosFeel } from "./iosFeel.js";
import { reset as resetHistory } from "./history.js";
import { seedFromBuild } from "./projectFiles.js";
import { planApp, type Blueprint, type BlueprintScreen } from "./architect.js";
import { renderAppShell, placeholderScreen } from "./buildShell.js";

export interface BuildResult {
  ok: boolean;
  files?: string[];
  error?: string;
  /** Non-fatal iOS-feel audit notes (Android-isms etc.). */
  warnings?: string[];
  /** Smart additions the architect made beyond the explicit ask. */
  addedExtras?: string[];
  /** The raw model output, kept for debugging when parsing fails. */
  raw?: string;
}

/** Progress callback so the socket can stream real per-phase/per-screen updates. */
export type OnProgress = (pct: number, label: string) => void;

const SCREEN_SYSTEM = (accent: string, background: string): ChatMessage => ({
  role: "system",
  content: `You are a senior React Native engineer building inside a visual editor where the user
edits the running app by TAPPING elements. The code you write MUST be tap-to-edit friendly.

OUTPUT FORMAT: respond with ONLY a JSON object, no markdown, of the shape:
{"code": "<full file contents of this one screen>"}

This app's design tokens — USE THESE so every screen matches:
- Accent / primary tint: "${accent}"
- Screen background: "${background}"

${IOS_FEEL_PROMPT}

${SCREEN_CONTRACT}`,
});

/** Build the per-screen user prompt from its blueprint slice. */
function screenUserPrompt(bp: Blueprint, screen: BlueprintScreen): string {
  const entities = bp.entities ?? [];
  const dataModel = entities.length
    ? `\nDATA MODEL — store REAL data with useEntity("Name") (items / add / update / remove). Seeded + persisted + shared across screens:\n${entities
        .map(
          (e) =>
            `- ${e.name}: { ${e.fields
              .map((f) => `${f.name}: ${f.type}`)
              .join(", ")} }`,
        )
        .join("\n")}`
    : "";
  const reads = screen.reads ?? [];
  const writes = screen.writes ?? [];
  const screenData =
    entities.length && (reads.length || writes.length)
      ? `\nThis screen should READ ${reads.join(", ") || "(none)"} and WRITE ${writes.join(", ") || "(none)"} via useEntity — render real rows with .map(), and make add/edit/delete actually mutate the store.`
      : "";
  const caps = bp.capabilities ?? [];
  const capLine = caps.length
    ? `\nCAPABILITIES this app uses: ${caps.join(", ")}. Use the kit wrappers where this screen needs them — camera/photo: pickImage()/pickImage({camera:true,base64:true}); reminders: scheduleReminder({title, at}); location: useLocation(); motion: useMotion(); AI: askAI(prompt) / classifyImage(dataUrl, question); live data: apiGet(url) / apiPost(url, body); image generation: generateImage(prompt)→url; voice: speak(text) / useVoiceInput(); RAG: indexDoc(text) / askDocs(question). They handle permissions/CORS and work in the preview.`
    : "";
  return `App: ${bp.appName}
This screen — id "${screen.id}", title "${screen.title}"${screen.isDetail ? " (a drill-in DETAIL screen reached via navigate)" : " (a bottom-tab screen)"}.
Purpose: ${screen.purpose}
Sections to include: ${screen.components.length ? screen.components.join("; ") : "design sensible sections for the purpose"}${dataModel}${screenData}${capLine}
${screen.sampleData ? `Extra static sample data for decorative sections:\n${JSON.stringify(screen.sampleData)}` : ""}
Other screens you can navigate() to: ${bp.screens
    .filter((s) => s.id !== screen.id)
    .map((s) => s.id)
    .join(", ") || "none"}

Write the complete file for screen "${screen.id}". export default function ${screen.id}({ navigate, goBack, params }).`;
}

const MAX_ATTEMPTS = 3;

/** Generate one screen file. Returns valid TSX, or null if every attempt fails. */
async function generateScreen(
  bp: Blueprint,
  screen: BlueprintScreen,
): Promise<string | null> {
  const messages: ChatMessage[] = [
    SCREEN_SYSTEM(bp.accent, bp.background),
    { role: "user", content: screenUserPrompt(bp, screen) },
  ];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let raw: string;
    try {
      raw = await chat(builderConfig(), { messages, temperature: 0.5, maxTokens: 28000 });
    } catch (e: any) {
      console.warn(`[build] ${screen.id} attempt ${attempt}: chat error ${e?.message}`);
      continue; // network/empty — retry
    }
    const parsed = extractJson<{ code: string }>(raw);
    const code = parsed?.code;
    if (typeof code !== "string" || !/export\s+default\s/.test(code)) {
      console.warn(
        `[build] ${screen.id} attempt ${attempt}: no usable code (len ${raw.length}, parsed=${!!parsed})`,
      );
      continue;
    }
    try {
      parse(code); // must be valid TSX before we trust it
    } catch (e: any) {
      console.warn(`[build] ${screen.id} attempt ${attempt}: parse failed ${e?.message}`);
      continue;
    }
    return code;
  }
  return null;
}

/**
 * Build a complete, dynamic, multi-screen app from a spec (or free-text idea):
 *   1) architect → blueprint (the screens this app actually needs)
 *   2) parallel codegen → one polished file per screen
 *   3) deterministic shell → App.tsx wiring tabs + push/pop navigation
 * Always writes a valid, runnable app (failed screens fall back to a placeholder).
 */
export async function buildApp(input: {
  spec?: AppSpec;
  idea?: string;
  projectId?: string;
  onProgress?: OnProgress;
}): Promise<BuildResult> {
  const progress = input.onProgress ?? (() => {});

  // ── Phase 1: architect ──────────────────────────────────────────────────
  progress(8, "Planning your app…");
  const bp = await planApp(input.spec, input.idea);
  progress(20, `Designing ${bp.screens.length} screen${bp.screens.length > 1 ? "s" : ""}…`);

  // ── Phase 2: parallel screen codegen ────────────────────────────────────
  let done = 0;
  const span = 65; // 20 → 85%
  const screenFiles = await Promise.all(
    bp.screens.map(async (screen) => {
      const code = await generateScreen(bp, screen);
      done += 1;
      progress(20 + Math.round((done / bp.screens.length) * span), `Built ${screen.title}`);
      return { screen, code: code ?? placeholderScreen(screen), fallback: code == null };
    }),
  );

  // ── Phase 3: deterministic shell + assemble ─────────────────────────────
  progress(88, "Wiring it all together…");
  const files: Record<string, string> = {
    "App.tsx": renderAppShell(bp, input.projectId),
  };
  for (const f of screenFiles) files[f.screen.file] = f.code;

  // Validate every file parses before writing anything.
  for (const [rel, content] of Object.entries(files)) {
    try {
      parse(content);
    } catch (e: any) {
      return { ok: false, error: `Generated ${rel} is not valid: ${e.message}`, raw: content };
    }
  }

  // Write the whole set.
  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    try {
      await writeFile(rel, content);
      written.push(rel);
    } catch (e: any) {
      return { ok: false, error: `Cannot write ${rel}: ${e.message}` };
    }
  }

  // Fresh app → fresh undo timeline (the built app is the "initial" state).
  resetHistory();
  if (input.projectId) {
    const fileMap: Record<string, string> = {};
    for (const rel of written) fileMap[rel] = files[rel];
    try {
      await seedFromBuild(input.projectId, fileMap);
    } catch {
      /* store failure shouldn't fail the build itself */
    }
  }

  progress(100, "Your app is live!");

  const warnings: string[] = [];
  for (const f of screenFiles) {
    if (f.fallback) warnings.push(`${f.screen.title} used a placeholder (generation failed)`);
    warnings.push(...auditIosFeel(f.code));
  }

  return { ok: true, files: written, warnings, addedExtras: bp.addedExtras };
}
