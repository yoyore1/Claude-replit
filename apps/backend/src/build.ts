import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { parse } from "@cr/codemod";
import { writeFile } from "./fileApi.js";
import { extractJson, type AppSpec } from "./interview.js";
import { IOS_FEEL_PROMPT, SCREEN_CONTRACT, auditIosFeel } from "./iosFeel.js";
import { reset as resetHistory } from "./history.js";
import { seedFromBuild } from "./projectFiles.js";
import {
  planApp,
  ensureStandardScreens,
  type Blueprint,
  type BlueprintScreen,
} from "./architect.js";
import {
  renderAppShell,
  placeholderScreen,
  renderStandardScreen,
} from "./buildShell.js";
import { legalDocs, supportEmailFor, type AppDocs } from "./legalDocs.js";
import { findDeadButtons } from "./lintButtons.js";

export interface BuildResult {
  ok: boolean;
  files?: string[];
  error?: string;
  /** Non-fatal iOS-feel audit notes (Android-isms etc.). */
  warnings?: string[];
  /** Smart additions the architect made beyond the explicit ask. */
  addedExtras?: string[];
  /** Screen titles still on a placeholder after retries — the app isn't fully
   *  done. Empty/absent means every screen generated for real. */
  incompleteScreens?: string[];
  /** The raw model output, kept for debugging when parsing fails. */
  raw?: string;
}

/** Progress callback so the socket can stream real per-phase/per-screen updates. */
export type OnProgress = (pct: number, label: string) => void;

const SCREEN_SYSTEM = (accent: string, background: string): ChatMessage => ({
  role: "system",
  content: `You are a senior React Native engineer building inside a visual editor where the user
edits the running app by TAPPING elements. The code you write MUST be tap-to-edit friendly.

OUTPUT FORMAT: respond with ONLY the complete file as a single fenced code block, nothing else:
\`\`\`tsx
<full file contents of this one screen>
\`\`\`
Do NOT wrap the code in JSON and do NOT add any commentary before or after the code block.

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

  // Two-sided role context: design this screen ONLY for its side.
  const role = screen.role
    ? (bp.roles ?? []).find((r) => r.id === screen.role)
    : undefined;
  const roleLine = role
    ? `\nROLE — this screen is for the "${role.label}" side of a two-sided app. Design it ONLY for what a ${role.label} needs (not the other side). Any shared data is seen from the ${role.label}'s perspective. The app already has a role chooser + tab bar — don't build your own.`
    : "";

  // Wizard step context: wire Continue → the next step; last step is the result.
  let wizardLine = "";
  if (bp.archetype === "wizard" && bp.flow) {
    const idx = bp.flow.steps.indexOf(screen.id);
    if (idx >= 0) {
      const total = bp.flow.steps.length;
      const isLast = idx === total - 1;
      wizardLine = isLast
        ? `\nWIZARD STEP ${idx + 1}/${total} (FINAL/RESULT) — show the outcome/summary and a primary AppButton that calls navigate("${bp.flow.steps[0]}") to start over. There is NO bottom tab bar (a progress bar + back/settings live in the top bar — don't build your own).`
        : `\nWIZARD STEP ${idx + 1}/${total} — one step of a guided flow. Keep it focused on THIS step and end with a primary "Continue" AppButton that calls navigate("${bp.flow.steps[idx + 1]}") to advance. There is NO bottom tab bar (the shell shows a progress bar + back — don't build your own).`;
    }
  }

  return `App: ${bp.appName}
This screen — id "${screen.id}", title "${screen.title}"${screen.isDetail ? " (a drill-in DETAIL screen reached via navigate)" : " (a bottom-tab screen)"}.${roleLine}${wizardLine}
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

/**
 * Pull a screen's TSX out of a model response. Prefers a fenced code block
 * (```tsx … ```) — far more reliable than the old "whole file as a JSON string"
 * contract, which broke whenever the file's quotes/newlines weren't perfectly
 * escaped. Falls back to that legacy JSON, then to the raw text if it's already
 * a module. Returns "" when nothing usable is found.
 */
export function extractCode(raw: string): string {
  // 1) Fenced block (most reliable): ```tsx | jsx | ts | js | (none)
  const fence = raw.match(
    /```(?:tsx|jsx|ts|js|typescript|javascript)?[ \t]*\r?\n([\s\S]*?)```/i,
  );
  if (fence && fence[1] && /export\s+default\s/.test(fence[1])) {
    return fence[1].trim();
  }
  // 2) Legacy {"code":"…"} JSON contract (back-compat).
  const json = extractJson<{ code?: string }>(raw);
  if (json && typeof json.code === "string" && /export\s+default\s/.test(json.code)) {
    return json.code;
  }
  // 3) The whole response is already the module.
  if (/export\s+default\s/.test(raw)) return raw.trim();
  return "";
}

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
      // Generous timeout: a full screen (up to 28k tokens) legitimately takes
      // well over the default 60s — don't abort a real generation.
      raw = await chat(builderConfig(), { messages, temperature: 0.5, maxTokens: 28000, timeoutMs: 240_000 });
    } catch (e: any) {
      console.warn(`[build] ${screen.id} attempt ${attempt}: chat error ${e?.message}`);
      continue; // network/empty — retry
    }
    const code = extractCode(raw);
    if (!code) {
      console.warn(
        `[build] ${screen.id} attempt ${attempt}: no usable code (len ${raw.length})`,
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
 * One corrective pass over a generated screen that has dead/placeholder buttons.
 * Asks the model to rewrite it so every interactive element does something real,
 * re-validates the result, and falls back to the original (never blocks a build).
 * Returns the (possibly repaired) code plus an optional warning.
 */
async function repairDeadButtons(
  bp: Blueprint,
  screen: BlueprintScreen,
  code: string,
): Promise<{ code: string; warning?: string }> {
  const issues = findDeadButtons(code);
  if (!issues.length) return { code };

  const others =
    bp.screens
      .filter((s) => s.id !== screen.id)
      .map((s) => s.id)
      .join(", ") || "none";
  const messages: ChatMessage[] = [
    SCREEN_SYSTEM(bp.accent, bp.background),
    {
      role: "user",
      content: `The generated screen "${screen.id}" has DEAD or placeholder interactions that must be fixed:
- ${issues.join("\n- ")}

Rewrite the COMPLETE file so EVERY interactive element does something real: navigate("OtherScreenId", params), mutate data via useEntity (add/update/remove), toggle real useState, open a <Sheet>, run a device API, or share(...). Remove every empty handler and every "coming soon"/placeholder dialog — wire the real behavior instead (e.g. a "Help" row should navigate to a real screen). Keep the same screen purpose, layout, imports, and component style.
Other screens you can navigate() to: ${others}.

Current file:
${code}`,
    },
  ];
  try {
    const raw = await chat(builderConfig(), {
      messages,
      temperature: 0.3,
      maxTokens: 28000,
      timeoutMs: 240_000,
    });
    const fixed = extractCode(raw);
    if (fixed) {
      parse(fixed); // must still be valid TSX
      const remaining = findDeadButtons(fixed);
      return remaining.length
        ? {
            code: fixed,
            warning: `${screen.title}: some interactions may still be placeholders`,
          }
        : { code: fixed };
    }
  } catch (e: any) {
    console.warn(`[build] ${screen.id} repair failed: ${e?.message}`);
  }
  return {
    code,
    warning: `${screen.title}: could not auto-repair placeholder buttons`,
  };
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
  // Guarantee Settings + Privacy/Terms/Support exist (added if the architect
  // didn't), with Settings reachable as a tab.
  ensureStandardScreens(bp);

  // Tailored, deterministic legal/support content — the SAME source the IDE
  // serves via GET /projects/:id/docs, so preview and on-device text match.
  const supportEmail = supportEmailFor(bp.appName);
  const docs: AppDocs = legalDocs({
    appName: bp.appName,
    capabilities: bp.capabilities,
    supportEmail,
    description: input.spec?.description,
  });

  progress(20, `Designing ${bp.screens.length} screen${bp.screens.length > 1 ? "s" : ""}…`);

  // ── Phase 2: parallel screen codegen ────────────────────────────────────
  let done = 0;
  const span = 65; // 20 → 85%
  const repairWarnings: string[] = [];
  const screenFiles = await Promise.all(
    bp.screens.map(async (screen) => {
      const tick = () => {
        done += 1;
        progress(20 + Math.round((done / bp.screens.length) * span), `Built ${screen.title}`);
      };
      // Required chrome is rendered from a deterministic template (never the LLM)
      // so it's always present and every button works.
      if (screen.standard) {
        const tmpl = renderStandardScreen(screen, docs, supportEmail, !!bp.roles);
        if (tmpl) {
          tick();
          return { screen, code: tmpl, fallback: false };
        }
      }
      let code = await generateScreen(bp, screen);
      if (code) {
        const repaired = await repairDeadButtons(bp, screen, code);
        code = repaired.code;
        if (repaired.warning) repairWarnings.push(repaired.warning);
      }
      tick();
      return { screen, code: code ?? placeholderScreen(screen), fallback: code == null };
    }),
  );

  // ── Phase 2b: retry stragglers ──────────────────────────────────────────
  // Any screen that fell back gets ONE more sequential attempt (cheap; with the
  // fenced-code contract most now succeed) before we call it incomplete.
  for (const f of screenFiles) {
    if (!f.fallback) continue;
    progress(86, `Retrying ${f.screen.title}…`);
    let code = await generateScreen(bp, f.screen);
    if (code) {
      const repaired = await repairDeadButtons(bp, f.screen, code);
      code = repaired.code;
      if (repaired.warning) repairWarnings.push(repaired.warning);
      f.code = code;
      f.fallback = false;
    }
  }

  // Screens still on a placeholder after the retry — the app is NOT fully done.
  const incompleteScreens = screenFiles
    .filter((f) => f.fallback)
    .map((f) => f.screen.title);

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
  if (bp.degraded) {
    warnings.unshift(
      "The app planner couldn't produce a full plan this time, so the app was built from your interview's screen list (tabs may be simpler than usual). Rebuilding will retry the full planner.",
    );
  }
  for (const f of screenFiles) {
    if (f.fallback) warnings.push(`${f.screen.title} used a placeholder (generation failed)`);
    warnings.push(...auditIosFeel(f.code));
  }
  warnings.push(...repairWarnings);

  return {
    ok: true,
    files: written,
    warnings,
    addedExtras: bp.addedExtras,
    incompleteScreens,
  };
}
