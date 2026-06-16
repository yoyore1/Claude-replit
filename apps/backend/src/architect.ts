import { chat, builderConfig, type ChatMessage } from "@cr/llm";
import { extractJson, type AppSpec } from "./interview.js";

/**
 * The "architect" phase of the build. Before any code is written, we expand the
 * interview spec / idea into a concrete app BLUEPRINT: the real set of screens a
 * version of THIS app actually needs (smartly adding obvious-but-unmentioned
 * ones), which screens are bottom-tabs vs drill-in details, and per-screen notes
 * the codegen step turns into polished iOS screens. This is where the product
 * intelligence lives; codegen just renders each screen from its blueprint slice.
 */

export interface BlueprintScreen {
  /** PascalCase, unique. Doubles as the nav id and React component name. */
  id: string;
  /** The large title shown at the top of the screen. */
  title: string;
  /** Repo-relative path, always src/screens/<id>.tsx. */
  file: string;
  /** One sentence on what this screen is for (drives codegen). */
  purpose: string;
  /** True = reachable via navigate() (e.g. a detail view), not a bottom tab. */
  isDetail: boolean;
  /** Ionicons name for the tab bar (tabs only). */
  icon?: string;
  /** UI sections/elements this screen should contain. */
  components: string[];
  /** Optional seed data so the screen looks alive. */
  sampleData?: unknown;
  /** Entity names this screen DISPLAYS (wired via useEntity for real data). */
  reads?: string[];
  /** Entity names this screen CREATES / EDITS / DELETES. */
  writes?: string[];
}

/** A real data collection the app stores, shares across screens, and persists. */
export interface BlueprintEntity {
  /** PascalCase singular collection name, e.g. "Habit", "Note". */
  name: string;
  /** Field names + a coarse type hint: text | number | bool | date. */
  fields: { name: string; type: string }[];
  /** A few seed rows so the app looks alive on first open. */
  seed: Record<string, any>[];
}

export interface Blueprint {
  appName: string;
  accent: string;
  background: string;
  /** Screen ids that are bottom-tab destinations, in display order. */
  tabs: string[];
  screens: BlueprintScreen[];
  /** The app's data model — the collections it actually stores and mutates.
   *  Empty for pure stateless tools (e.g. a tip calculator). */
  entities: BlueprintEntity[];
  /** Device features the app needs: "camera" | "notifications" | "location" | "motion". */
  capabilities: string[];
  /** Smart additions made beyond what the user asked for (for the build log). */
  addedExtras: string[];
}

/** Capabilities the kit can wire up (see ui/device.ts, ui/net.ts, ui/media.ts). */
const CAPABILITIES = [
  "camera",
  "notifications",
  "location",
  "motion",
  "ai",
  "internet",
  "images",
  "voice",
  "docs",
];

const MAX_SCREENS = 7;

/** Tab icons that render well in both Expo (Ionicons) and the web preview shim. */
const TAB_ICONS =
  "home, search, add, person, settings, heart, star, notifications, list, calendar, cart, bag, book, barbell, restaurant, wallet, chatbubble, camera, map, time, grid, musical-notes, cash, paw, leaf, fitness";

const SYSTEM: ChatMessage = {
  role: "system",
  content: `You are the product architect for a no-code app builder. Given an app idea (and a
rough spec from a friendly interview), you design the BLUEPRINT for a real, complete iOS app.

Think like a senior product designer: figure out what KIND of app this is, then lay out the
screens a genuinely useful version of it needs — including the obvious ones the user did not
think to mention. Be smart and thorough, but tasteful.

Examples of good instincts:
- A shop → Storefront (tab), Product detail (drill-in), Cart (tab), Checkout (drill-in), Orders/Settings (tab).
- A workout tracker → Today (tab), Log workout (tab), History (tab), Insights (tab), Settings (tab).
- A recipe box → Recipes (tab), Recipe detail (drill-in), Add recipe (tab), Shopping list (tab), Settings (tab).
- A simple one-purpose tool → maybe just ONE screen, no tabs.

DATA MODEL — this app stores REAL data, not just mockups.
- Design the collections (ENTITIES) the app actually needs: a habit tracker → "Habit"; a
  notes app → "Note"; a budget → "Transaction". Give each a few fields (name + coarse type:
  text | number | bool | date) and 2-4 realistic SEED rows so it looks alive on first open.
- Mark, per screen, which entities it READS (displays) and WRITES (adds/edits/deletes).
- A pure stateless tool (e.g. a tip calculator, a unit converter) can have NO entities —
  use an empty "entities" array then.
- Keep it lean: 0-5 entities total. Model only what the app truly needs.

DEVICE FEATURES — the app can use the phone's hardware. List in "capabilities" ONLY the ones
the idea genuinely needs (omit otherwise):
- "camera" — take or pick photos (e.g. a photo journal, "scan" something)
- "notifications" — local reminders / alarms (e.g. habit nudges, an alarm)
- "location" — GPS coordinates (e.g. nearby, check-in, run tracker)
- "motion" — accelerometer / shake (e.g. step counter, shake-to-act)
- "ai" — ask a model questions or about a photo (e.g. recognize/identify, categorize, summarize,
  generate text). Pair with "camera" for "scan/identify what's in a photo" features.
- "internet" — fetch LIVE data from public APIs (e.g. weather, news, prices, sports, maps).
- "images" — GENERATE images from a text prompt (e.g. art, avatars, mockups, scene ideas).
- "voice" — speak text aloud (TTS) and/or take voice input transcribed to text (STT).
- "docs" — RAG: answer questions grounded in documents the user adds (a knowledge base / "chat
  with my notes"). Needs Supabase configured server-side.
Design screens/flows that actually use them when relevant (e.g. an alarm app → "notifications";
a photo-identify app → "camera" + "ai"; a weather app → "internet"; an art app → "images";
a voice notes app → "voice"; a study/notes Q&A app → "docs").

RULES
- Bottom TABS are top-level destinations (2-5 of them). DETAIL screens (isDetail:true) are reached
  by tapping something (e.g. a list row → its detail) and are NOT in the tab bar.
- Total screens MUST be <= ${MAX_SCREENS}. Pick the RIGHT number for the app — do not pad.
- Every screen id is PascalCase and unique (e.g. "Home", "ProductDetail").
- Entity names are PascalCase singular (e.g. "Habit", "Note"). Screen reads/writes must
  reference these exact names.
- Tab icons come from this Ionicons set: ${TAB_ICONS}.
- Put anything you ADDED beyond the user's explicit ask into "addedExtras" as short phrases.
- Choose an accent and background hex that match the requested vibe.

OUTPUT: reply with ONLY a JSON object (no markdown fences) of this exact shape:
{
  "appName": string,
  "accent": "#rrggbb",
  "background": "#rrggbb",
  "tabs": ["ScreenId", ...],
  "capabilities": ["camera", "notifications"],
  "entities": [
    {"name":"Habit","fields":[{"name":"title","type":"text"},{"name":"streak","type":"number"},{"name":"doneToday","type":"bool"}],
     "seed":[{"title":"Drink water","streak":4,"doneToday":false},{"title":"Read","streak":12,"doneToday":true}]}
  ],
  "screens": [
    {"id":"Home","title":"...","purpose":"...","isDetail":false,"icon":"home",
     "components":["hero summary card","quick actions list","recent items"],
     "reads":["Habit"],"writes":["Habit"],
     "sampleData":{"items":[{"name":"...","detail":"..."}]}}
  ],
  "addedExtras": ["..."]
}`,
};

function userContent(spec: AppSpec | undefined, idea: string | undefined): string {
  if (spec) {
    return `Design the blueprint for this app spec:\n${JSON.stringify(spec, null, 2)}`;
  }
  return `Design the blueprint for this app idea: ${idea ?? "a simple useful app"}`;
}

function pascal(s: string, fallback: string): string {
  const cleaned = (s || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : fallback;
}

/** Validate + normalize whatever the model returned into a safe Blueprint. */
function normalize(
  raw: any,
  spec: AppSpec | undefined,
  idea: string | undefined,
): Blueprint | null {
  if (!raw || !Array.isArray(raw.screens) || raw.screens.length === 0) return null;

  const seen = new Set<string>();
  const screens: BlueprintScreen[] = [];
  for (const s of raw.screens) {
    if (!s || typeof s !== "object") continue;
    let id = pascal(String(s.id || s.title || ""), `Screen${screens.length + 1}`);
    while (seen.has(id)) id = `${id}2`;
    seen.add(id);
    const strList = (v: any): string[] =>
      Array.isArray(v) ? v.map((x) => String(x)).slice(0, 8) : [];
    screens.push({
      id,
      title: String(s.title || id).slice(0, 40),
      file: `src/screens/${id}.tsx`,
      purpose: String(s.purpose || "").slice(0, 300),
      isDetail: Boolean(s.isDetail),
      icon: typeof s.icon === "string" ? s.icon : undefined,
      components: Array.isArray(s.components)
        ? s.components.map((c: any) => String(c)).slice(0, 10)
        : [],
      sampleData: s.sampleData,
      reads: strList(s.reads),
      writes: strList(s.writes),
    });
    if (screens.length >= MAX_SCREENS) break;
  }
  if (!screens.length) return null;

  // Parse the data model, keeping only well-formed entities.
  const entities: BlueprintEntity[] = Array.isArray(raw.entities)
    ? raw.entities
        .filter((e: any) => e && typeof e === "object" && (e.name || e.fields))
        .map((e: any) => ({
          name: pascal(String(e.name || "Item"), "Item"),
          fields: Array.isArray(e.fields)
            ? e.fields
                .filter((f: any) => f && f.name)
                .map((f: any) => ({
                  name: String(f.name),
                  type: String(f.type || "text"),
                }))
                .slice(0, 12)
            : [],
          seed: Array.isArray(e.seed)
            ? e.seed
                .filter((r: any) => r && typeof r === "object")
                .slice(0, 8)
            : [],
        }))
        .slice(0, 6)
    : [];

  const ids = new Set(screens.map((s) => s.id));
  let tabs = Array.isArray(raw.tabs)
    ? raw.tabs.map(String).filter((t: string) => ids.has(t) && !screens.find((s) => s.id === t)?.isDetail)
    : [];
  // Always have at least one tab (the first non-detail screen).
  if (!tabs.length) {
    const firstTop = screens.find((s) => !s.isDetail) ?? screens[0];
    firstTop.isDetail = false;
    tabs = [firstTop.id];
  }

  return {
    appName: String(raw.appName || spec?.name || idea || "My App").slice(0, 40),
    accent: hex(raw.accent) || spec?.primaryColor || "#007AFF",
    background: hex(raw.background) || spec?.backgroundColor || "#F2F2F7",
    tabs,
    screens,
    entities,
    capabilities: Array.isArray(raw.capabilities)
      ? raw.capabilities
          .map((c: any) => String(c))
          .filter((c: string) => CAPABILITIES.includes(c))
      : [],
    addedExtras: Array.isArray(raw.addedExtras)
      ? raw.addedExtras.map((x: any) => String(x)).slice(0, 6)
      : [],
  };
}

function hex(v: any): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : null;
}

/** A minimal but valid single-screen blueprint, used when the model misbehaves. */
function fallbackBlueprint(spec: AppSpec | undefined, idea: string | undefined): Blueprint {
  const name = spec?.name || idea?.slice(0, 40) || "My App";
  return {
    appName: name,
    accent: spec?.primaryColor || "#007AFF",
    background: spec?.backgroundColor || "#F2F2F7",
    tabs: ["Home"],
    screens: [
      {
        id: "Home",
        title: name,
        file: "src/screens/Home.tsx",
        purpose: spec?.description || idea || "The main screen of the app.",
        isDetail: false,
        icon: "home",
        components: (spec?.features ?? []).slice(0, 5),
        sampleData: undefined,
      },
    ],
    entities: [],
    capabilities: [],
    addedExtras: [],
  };
}

/** Plan the whole app. Always returns a usable blueprint (never throws). */
export async function planApp(
  spec: AppSpec | undefined,
  idea: string | undefined,
): Promise<Blueprint> {
  const messages: ChatMessage[] = [SYSTEM, { role: "user", content: userContent(spec, idea) }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chat(builderConfig(), { messages, temperature: 0.5, maxTokens: 4000 });
      const bp = normalize(extractJson<any>(raw), spec, idea);
      if (bp) return bp;
    } catch {
      /* retry */
    }
  }
  return fallbackBlueprint(spec, idea);
}
