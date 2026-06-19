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
  /** Required-chrome screen rendered from a deterministic template, not the LLM
   *  (Settings, Privacy, Terms, Support). Codegen skips generation for these. */
  standard?: boolean;
  /** For two-sided apps: the role id this screen is specific to (e.g. "owner").
   *  Absent = shared across roles. Drives role-aware codegen. */
  role?: string;
}

/** One side of a two-sided app (e.g. "owner" vs "walker"). */
export interface BlueprintRole {
  /** Short lowercase id, e.g. "owner". */
  id: string;
  /** Display label shown on the role chooser, e.g. "Dog owner". */
  label: string;
  /** Ionicons name for the role card. */
  icon?: string;
  /** One-line description shown under the label on the chooser. */
  blurb?: string;
  /** Screen ids that are this role's bottom tabs, in order. */
  tabs: string[];
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
  /** True when the LLM planner failed and we built from a fallback (degraded). */
  degraded?: boolean;
  /** The app's structural shape, decided at plan time. Default "tabbed". */
  archetype?: "tabbed" | "tool" | "twoSided" | "wizard";
  /** Two-sided apps only: the distinct user sides, each with its own tabs.
   *  The app opens on a role chooser before any tabs. */
  roles?: BlueprintRole[];
  /** Wizard apps only: the ordered screen ids forming the linear step flow. */
  flow?: { steps: string[] };
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
- A dog-walking marketplace → TWO-SIDED: an owner side (Find walkers, Bookings, Messages) and a walker
  side (Requests, Schedule, Earnings, Messages), sharing one Booking + one Message entity.
- A personality quiz → WIZARD: Welcome → Question 1 → Question 2 → Question 3 → Result.

ARCHETYPE — classify the app's SHAPE first; it changes the whole structure. Set "archetype" to ONE of:
- "twoSided": the app serves 2+ DISTINCT user types who each need a DIFFERENT experience (owner↔walker,
  buyer↔seller, rider↔driver, host↔guest, patient↔provider, student↔tutor, renter↔landlord,
  attendee↔organizer). The app OPENS on a role chooser, then shows that role's OWN tabs. Provide "roles":
  each { "id": short lowercase, "label", "icon" (from the tab-icon set), "blurb" (one line), "tabs":
  [screen ids for THAT role] }. Mark each role-specific screen with "role":"<roleId>". SHARED screens
  (used by both, e.g. Messages) leave "role" off and may appear in multiple roles' tabs. Model shared
  DATA as ONE entity both sides use (a single "Booking" the owner books and the walker fulfils).
- "wizard": the app IS a guided multi-step flow (quiz, intake/onboarding form, calculator-with-steps,
  build-your-X). Provide "flow":{"steps":[ordered screen ids]} ending in a result/summary screen. No
  tabs — each step leads to the next.
- "tabbed" (DEFAULT): a normal bottom-tab app. "tool": a single-screen utility.
Most apps are "tabbed" — only choose twoSided/wizard when the idea genuinely calls for it.

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
  "archetype": "tabbed",
  "tabs": ["ScreenId", ...],
  "roles": [ {"id":"owner","label":"Dog owner","icon":"paw","blurb":"Book and track walks","tabs":["OwnerHome","Bookings","Messages"]},
             {"id":"walker","label":"Dog walker","icon":"walk","blurb":"Find clients, manage walks","tabs":["WalkerHome","Schedule","Messages"]} ],
  "flow": {"steps":["Welcome","Question1","Result"]},
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
}
Include "roles" ONLY when archetype is "twoSided", and "flow" ONLY when it is "wizard"; omit them
otherwise. Add "role":"<roleId>" on screens that belong to a single role.`,
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
      role: typeof s.role === "string" ? s.role.toLowerCase() : undefined,
    });
    // Soft target is MAX_SCREENS, but two-sided/wizard apps legitimately need
    // more (role-specific + shared screens), so allow a higher hard ceiling.
    if (screens.length >= 10) break;
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

  // ── Archetype: classify the app's shape, validating any roles/flow. Anything
  // malformed degrades safely to a plain "tabbed" app rather than breaking. ──
  let archetype: Blueprint["archetype"] =
    raw.archetype === "twoSided" || raw.archetype === "wizard" || raw.archetype === "tool"
      ? raw.archetype
      : "tabbed";

  let roles: BlueprintRole[] | undefined;
  if (archetype === "twoSided") {
    const rseen = new Set<string>();
    const parsed: BlueprintRole[] = (Array.isArray(raw.roles) ? raw.roles : [])
      .filter((r: any) => r && (r.id || r.label))
      .map((r: any) => {
        const id =
          String(r.id || r.label || "role")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "")
            .slice(0, 20) || "role";
        const rtabs = Array.from(
          new Set((Array.isArray(r.tabs) ? r.tabs.map(String) : []).filter((t: string) => ids.has(t))),
        ) as string[];
        return {
          id,
          label: String(r.label || r.id || "Role").slice(0, 30),
          icon: typeof r.icon === "string" ? r.icon : undefined,
          blurb: typeof r.blurb === "string" ? r.blurb.slice(0, 80) : undefined,
          tabs: rtabs,
        };
      })
      .filter((r: BlueprintRole) => r.tabs.length > 0 && !rseen.has(r.id) && rseen.add(r.id))
      .slice(0, 4);
    if (parsed.length >= 2) roles = parsed;
    else archetype = "tabbed"; // claimed two-sided but roles don't hold up
  }

  let flow: { steps: string[] } | undefined;
  if (archetype === "wizard") {
    const steps = Array.from(
      new Set((raw.flow && Array.isArray(raw.flow.steps) ? raw.flow.steps.map(String) : []).filter((s: string) => ids.has(s))),
    ) as string[];
    if (steps.length >= 2) flow = { steps };
    else archetype = "tabbed"; // claimed wizard but no usable step flow
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
    archetype,
    roles,
    flow,
  };
}

function hex(v: any): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : null;
}

/** Best-effort tab icon from a screen name, for the fallback path. */
function guessIcon(name: string): string {
  const n = name.toLowerCase();
  if (/home|discover|browse|feed|explore|nearby/.test(n)) return "home";
  if (/search|find/.test(n)) return "search";
  if (/profile|account|\bme\b/.test(n)) return "person";
  if (/book|schedul|calendar|appoint|reserv/.test(n)) return "calendar";
  if (/messag|chat|inbox|conversation/.test(n)) return "chatbubble";
  if (/review|rate|rating|feedback/.test(n)) return "star";
  if (/cart|checkout|order|shop|store|market/.test(n)) return "cart";
  if (/map|location|route/.test(n)) return "map";
  if (/setting/.test(n)) return "settings";
  if (/list|task|note|log/.test(n)) return "list";
  if (/photo|gallery|camera/.test(n)) return "camera";
  if (/wallet|pay|budget|money|cash|earning/.test(n)) return "wallet";
  if (/notif|alert/.test(n)) return "notifications";
  if (/heart|favorite|saved|like/.test(n)) return "heart";
  return "ellipse";
}

/**
 * A valid blueprint used when the LLM planner misbehaves. We do NOT collapse to a
 * single screen: the interview already produced a screen list, so we build those
 * as real tabs (first few) + drill-in details, so the user still gets the app
 * structure they designed. `degraded:true` so the build can surface a warning.
 */
function fallbackBlueprint(spec: AppSpec | undefined, idea: string | undefined): Blueprint {
  const name = spec?.name || idea?.slice(0, 40) || "My App";
  const accent = spec?.primaryColor || "#007AFF";
  const background = spec?.backgroundColor || "#F2F2F7";
  const base = { appName: name, accent, background, entities: [], capabilities: [], addedExtras: [], degraded: true };

  const specScreens = spec?.screens ?? [];
  if (specScreens.length) {
    const seen = new Set<string>();
    const screens: BlueprintScreen[] = [];
    for (const sc of specScreens) {
      let id = pascal(String(sc?.name || ""), `Screen${screens.length + 1}`);
      while (seen.has(id)) id = `${id}2`;
      seen.add(id);
      screens.push({
        id,
        title: String(sc?.name || id).slice(0, 40),
        file: `src/screens/${id}.tsx`,
        purpose: String(sc?.purpose || "").slice(0, 300),
        isDetail: false,
        icon: guessIcon(String(sc?.name || "")),
        components: [],
      });
      if (screens.length >= MAX_SCREENS) break;
    }
    // First 4 become bottom tabs (leaving room for the always-added Settings tab,
    // so the bar stays ≤5); any beyond become drill-in detail screens.
    const tabs: string[] = [];
    screens.forEach((s, i) => {
      if (i < 4) tabs.push(s.id);
      else s.isDetail = true;
    });
    return { ...base, tabs, screens };
  }

  // No interview screens at all — last-resort single screen.
  return {
    ...base,
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
  };
}

/**
 * The required "chrome" screens every app ships with. Settings is a reachable
 * tab; the three documents are drill-in detail screens opened from Settings.
 * These are rendered from deterministic templates (see buildShell.ts), so they
 * are always present, always functional, and never depend on the LLM.
 */
const STANDARD_SCREENS: BlueprintScreen[] = [
  {
    id: "Settings",
    title: "Settings",
    file: "src/screens/Settings.tsx",
    purpose:
      "App preferences, the privacy/terms/support documents, and account management.",
    isDetail: false,
    icon: "settings",
    components: [],
    standard: true,
  },
  {
    id: "PrivacyPolicy",
    title: "Privacy Policy",
    file: "src/screens/PrivacyPolicy.tsx",
    purpose: "How this app handles your data.",
    isDetail: true,
    components: [],
    standard: true,
  },
  {
    id: "TermsOfService",
    title: "Terms of Service",
    file: "src/screens/TermsOfService.tsx",
    purpose: "The terms for using this app.",
    isDetail: true,
    components: [],
    standard: true,
  },
  {
    id: "Support",
    title: "Support",
    file: "src/screens/Support.tsx",
    purpose: "Help, FAQs, and how to contact support.",
    isDetail: true,
    components: [],
    standard: true,
  },
];

/**
 * Guarantee the four standard screens exist and Settings is reachable as a tab.
 * Missing screens are appended; if the architect already produced a screen with
 * the same id (commonly "Settings"), we take it over as the deterministic one so
 * it always has working legal links + a Delete Account control. Required chrome
 * is allowed to exceed MAX_SCREENS.
 */
export function ensureStandardScreens(bp: Blueprint): void {
  for (const std of STANDARD_SCREENS) {
    const existing = bp.screens.find((s) => s.id === std.id);
    if (existing) {
      existing.standard = true;
      existing.isDetail = std.isDetail;
      existing.file = std.file;
      existing.title = existing.title || std.title;
      if (std.icon && !existing.icon) existing.icon = std.icon;
    } else {
      bp.screens.push({ ...std });
    }
  }
  // Wizard apps have no tab bar — Settings is reached from the top-bar gear, so
  // don't force it into tabs.
  if (bp.archetype === "wizard") return;

  if (!bp.tabs.includes("Settings")) bp.tabs.push("Settings");
  // Two-sided: Settings (with Switch role) must be reachable on EVERY side.
  if (bp.roles) {
    for (const r of bp.roles) {
      if (!r.tabs.includes("Settings")) r.tabs.push("Settings");
    }
  }
}

/** Plan the whole app. Always returns a usable blueprint (never throws). */
export async function planApp(
  spec: AppSpec | undefined,
  idea: string | undefined,
): Promise<Blueprint> {
  const messages: ChatMessage[] = [SYSTEM, { role: "user", content: userContent(spec, idea) }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chat(builderConfig(), { messages, temperature: 0.5, maxTokens: 12000, timeoutMs: 120_000 });
      const bp = normalize(extractJson<any>(raw), spec, idea);
      if (bp) return bp;
    } catch {
      /* retry */
    }
  }
  return fallbackBlueprint(spec, idea);
}
