import type { Blueprint, BlueprintScreen } from "./architect.js";
import type { AppDocs, Doc } from "./legalDocs.js";

/**
 * Deterministic assembly of App.tsx from a blueprint. The LLM never writes the
 * navigation wiring — this template does — so imports always resolve and the
 * tab bar / push-pop stack always work. Tab labels and the "Back" label are
 * plain literals in App.tsx, so they stay tap-to-edit-able like everything else.
 */

const GREY = "#8E8E93";

function shortLabel(title: string): string {
  const w = (title || "").trim().split(/\s+/)[0] || "Tab";
  return w.length > 14 ? w.slice(0, 14) : w;
}

/** Escape a string for embedding as JSX text / a JS string literal. */
function lit(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderAppShell(bp: Blueprint, appId?: string): string {
  // Stable per-app id so cloud data (RAG) stays isolated between apps. Prefer the
  // project id; fall back to a slug of the app name.
  const stableAppId =
    (appId || "").trim() ||
    (bp.appName || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "app";

  const imports = bp.screens
    .map((s) => `import ${s.id} from "./${s.file.replace(/\.tsx$/, "")}";`)
    .join("\n");

  const registry = bp.screens.map((s) => s.id).join(", ");

  const tabScreens = bp.tabs
    .map((id) => bp.screens.find((s) => s.id === id))
    .filter((s): s is BlueprintScreen => Boolean(s));

  const showTabBar = tabScreens.length > 1;

  const tabButtons = tabScreens
    .map((s) => {
      const label = shortLabel(s.title);
      const icon = s.icon || "ellipse";
      return `        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("${s.id}"); }}>
          <Icon name="${lit(icon)}" size={24} style={tab === "${s.id}" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "${s.id}" ? styles.tabLabelOn : styles.tabLabel}>${lit(label)}</Text>
        </Pressable>`;
    })
    .join("\n");

  const firstTab = tabScreens[0]?.id || bp.screens[0].id;

  // The tab bar floats as a translucent frosted (Liquid Glass) bar; content
  // scrolls underneath it for the premium-iOS look.
  const tabBarSection = showTabBar
    ? `      {stack.length === 0 ? (
        <GlassPanel tint="light" style={styles.tabBar}>
          <SafeAreaView edges={["bottom"]} style={styles.tabBarInner}>
${tabButtons}
          </SafeAreaView>
        </GlassPanel>
      ) : null}`
    : "";

  // Seed the persisted data store from the blueprint's entities (each row gets a
  // stable id). Apps with no data model skip the store entirely.
  const entities = bp.entities ?? [];
  const hasData = entities.length > 0;
  const seed: Record<string, any[]> = {};
  for (const e of entities) {
    seed[e.name] = (e.seed ?? []).map((row, i) => ({
      id: (row as any)?.id ?? `${e.name.toLowerCase()}_${i + 1}`,
      ...(row as Record<string, any>),
    }));
  }
  const storeImport = hasData ? ", StoreProvider" : "";
  const seedConst = hasData
    ? `\nconst SEED = ${JSON.stringify(seed)};\n`
    : "";
  const appBody = hasData
    ? `    <StoreProvider seed={SEED}>
      <AppInner />
    </StoreProvider>`
    : `    <AppInner />`;

  // Archetype-specific shells (decided at plan time). The flat tabbed shell below
  // is the default; two-sided apps get a role chooser, wizards get a step flow.
  const ctx: ShellCtx = { stableAppId, imports, registry, storeImport, seedConst, appBody };
  if (bp.roles && bp.roles.length >= 2) return renderTwoSidedShell(bp, ctx);
  if (bp.archetype === "wizard" && bp.flow && bp.flow.steps.length >= 2)
    return renderWizardShell(bp, ctx);

  return `import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors, setAppId, GlassPanel${storeImport} } from "./ui";
${imports}

// Pin the UI kit's tint to this app's accent color.
colors.tint = "${lit(bp.accent)}";
// Scope this app's cloud data (RAG) to its own id.
setAppId("${lit(stableAppId)}");
${seedConst}
const SCREENS = { ${registry} };

function AppInner() {
  const [tab, setTab] = useState("${firstTab}");
  const [stack, setStack] = useState([]);

  const navigate = (screen, params) =>
    setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS["${firstTab}"];

  // iOS-style horizontal slide whenever the visible screen changes (push/pop/tab).
  const slideX = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    slideX.setValue(Dimensions.get("window").width);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeId]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {stack.length > 0 ? (
          <GlassPanel tint="light" style={styles.navBar}>
            <Pressable style={styles.backRow} onPress={goBack}>
              <Icon name="chevron-back" size={26} style={styles.backIcon} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </GlassPanel>
        ) : null}
        <Animated.View style={[styles.content, { transform: [{ translateX: slideX }] }]}>
          <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} />
        </Animated.View>
      </SafeAreaView>
${tabBarSection}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
${appBody}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "${lit(bp.background)}" },
  flex: { flex: 1 },
  content: { flex: 1, overflow: "hidden" },
  navBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.29)",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  backIcon: { color: "${lit(bp.accent)}" },
  backText: { fontSize: 17, color: "${lit(bp.accent)}", marginLeft: 2 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.29)",
  },
  tabBarInner: {
    flexDirection: "row",
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minHeight: 44,
  },
  tabIcon: { color: "${GREY}" },
  tabIconOn: { color: "${lit(bp.accent)}" },
  tabLabel: { fontSize: 10, color: "${GREY}", marginTop: 2, fontWeight: "500" },
  tabLabelOn: { fontSize: 10, color: "${lit(bp.accent)}", marginTop: 2, fontWeight: "600" },
});
`;
}

/* ===================== archetype shells (roles / wizard) ===================== */

interface ShellCtx {
  stableAppId: string;
  imports: string;
  registry: string;
  storeImport: string;
  seedConst: string;
  appBody: string;
}

/** Shared StyleSheet entries (root/nav/tab bar) reused by the archetype shells. */
function baseStyleEntries(bp: Blueprint): string {
  return `root: { flex: 1, backgroundColor: "${lit(bp.background)}" },
  flex: { flex: 1 },
  content: { flex: 1, overflow: "hidden" },
  navBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(60,60,67,0.29)" },
  backRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10, minHeight: 44 },
  backIcon: { color: "${lit(bp.accent)}" },
  backText: { fontSize: 17, color: "${lit(bp.accent)}", marginLeft: 2 },
  tabBar: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(60,60,67,0.29)" },
  tabBarInner: { flexDirection: "row", paddingTop: 8 },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, minHeight: 44 },
  tabIcon: { color: "${GREY}" },
  tabIconOn: { color: "${lit(bp.accent)}" },
  tabLabel: { fontSize: 10, color: "${GREY}", marginTop: 2, fontWeight: "500" },
  tabLabelOn: { fontSize: 10, color: "${lit(bp.accent)}", marginTop: 2, fontWeight: "600" },`;
}

/** Two-sided app: a role chooser before the tabs, then per-role tab sets. */
function renderTwoSidedShell(bp: Blueprint, ctx: ShellCtx): string {
  const roles = bp.roles ?? [];

  // Per-role tab bars (literal buttons; only the active role's renders).
  const roleTabBlocks = roles
    .map((r) => {
      const tabScreens = r.tabs
        .map((id) => bp.screens.find((s) => s.id === id))
        .filter((s): s is BlueprintScreen => Boolean(s));
      const buttons = tabScreens
        .map((s) => {
          const label = shortLabel(s.title);
          const icon = s.icon || "ellipse";
          return `            <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("${s.id}"); }}>
              <Icon name="${lit(icon)}" size={24} style={tab === "${s.id}" ? styles.tabIconOn : styles.tabIcon} />
              <Text style={tab === "${s.id}" ? styles.tabLabelOn : styles.tabLabel}>${lit(label)}</Text>
            </Pressable>`;
        })
        .join("\n");
      return `        {role === "${r.id}" && stack.length === 0 ? (
          <GlassPanel tint="light" style={styles.tabBar}>
            <SafeAreaView edges={["bottom"]} style={styles.tabBarInner}>
${buttons}
            </SafeAreaView>
          </GlassPanel>
        ) : null}`;
    })
    .join("\n");

  // Role chooser cards (literal copy → tap-to-edit friendly).
  const roleCards = roles
    .map((r) => {
      const icon = r.icon || "person";
      const blurb = r.blurb
        ? `\n            <Text style={styles.roleBlurb}>${lit(r.blurb)}</Text>`
        : "";
      return `        <Pressable style={styles.roleCard} onPress={() => onPick("${r.id}")}>
          <View style={styles.roleIcon}><Icon name="${lit(icon)}" size={26} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.roleLabel}>${lit(r.label)}</Text>${blurb}
          </View>
          <Icon name="chevron-forward" size={20} color="#C7C7CC" />
        </Pressable>`;
    })
    .join("\n");

  const firstTabByRole = JSON.stringify(
    Object.fromEntries(roles.map((r) => [r.id, r.tabs[0]])),
  );

  return `import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon, colors, setAppId, GlassPanel${ctx.storeImport} } from "./ui";
${ctx.imports}

colors.tint = "${lit(bp.accent)}";
setAppId("${lit(ctx.stableAppId)}");
${ctx.seedConst}
const SCREENS = { ${ctx.registry} };
const FIRST_TAB = ${firstTabByRole};
const ROLE_KEY = "appable.role";

function RoleGate({ onPick }) {
  return (
    <SafeAreaView style={styles.gateRoot} edges={["top", "bottom"]}>
      <View style={styles.gateInner}>
        <Text style={styles.gateTitle}>Welcome to ${lit(bp.appName)}</Text>
        <Text style={styles.gateSub}>How will you be using it?</Text>
${roleCards}
      </View>
    </SafeAreaView>
  );
}

function AppInner() {
  const [role, setRole] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(null);
  const [stack, setStack] = useState([]);

  useEffect(() => {
    AsyncStorage.getItem(ROLE_KEY)
      .then((r) => { if (r) { setRole(r); setTab(FIRST_TAB[r]); } setReady(true); })
      .catch(() => setReady(true));
  }, []);

  const pickRole = (r) => {
    AsyncStorage.setItem(ROLE_KEY, r).catch(() => {});
    setRole(r); setTab(FIRST_TAB[r]); setStack([]);
  };

  const navigate = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS[tab];

  const slideX = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    slideX.setValue(Dimensions.get("window").width);
    Animated.timing(slideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeId]);

  if (!ready) return <View style={styles.root} />;
  if (!role) return <RoleGate onPick={pickRole} />;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {stack.length > 0 ? (
          <GlassPanel tint="light" style={styles.navBar}>
            <Pressable style={styles.backRow} onPress={goBack}>
              <Icon name="chevron-back" size={26} style={styles.backIcon} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </GlassPanel>
        ) : null}
        <Animated.View style={[styles.content, { transform: [{ translateX: slideX }] }]}>
          {Active ? <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} /> : null}
        </Animated.View>
      </SafeAreaView>
${roleTabBlocks}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
${ctx.appBody}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  ${baseStyleEntries(bp)}
  gateRoot: { flex: 1, backgroundColor: "${lit(bp.background)}" },
  gateInner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  gateTitle: { fontSize: 28, fontWeight: "700", color: "#1C1C1E", marginBottom: 6 },
  gateSub: { fontSize: 16, color: "#8E8E93", marginBottom: 24 },
  roleCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 12 },
  roleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "${lit(bp.accent)}", alignItems: "center", justifyContent: "center", marginRight: 14 },
  roleLabel: { fontSize: 17, fontWeight: "600", color: "#1C1C1E" },
  roleBlurb: { fontSize: 13, color: "#8E8E93", marginTop: 2 },
});
`;
}

/** Wizard app: a linear step flow with a progress header, no bottom tabs. */
function renderWizardShell(bp: Blueprint, ctx: ShellCtx): string {
  const steps = bp.flow?.steps ?? [];
  const firstStep = steps[0];
  const STEPS = JSON.stringify(steps);

  return `import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors, setAppId${ctx.storeImport} } from "./ui";
${ctx.imports}

colors.tint = "${lit(bp.accent)}";
setAppId("${lit(ctx.stableAppId)}");
${ctx.seedConst}
const SCREENS = { ${ctx.registry} };
const STEPS = ${STEPS};

function AppInner() {
  const [tab] = useState("${firstStep}");
  const [stack, setStack] = useState([]);
  const navigate = (screen, params) => setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));
  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS["${firstStep}"];
  const stepIdx = STEPS.indexOf(activeId);

  const slideX = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    slideX.setValue(Dimensions.get("window").width);
    Animated.timing(slideX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [activeId]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        <View style={styles.wizBar}>
          {stack.length > 0 ? (
            <Pressable onPress={goBack} hitSlop={10}><Icon name="chevron-back" size={26} style={styles.backIcon} /></Pressable>
          ) : (
            <View style={{ width: 26 }} />
          )}
          <View style={styles.progressWrap}>
            {stepIdx >= 0 ? <View style={[styles.progressFill, { width: (((stepIdx + 1) / STEPS.length) * 100) + "%" }]} /> : null}
          </View>
          <Pressable onPress={() => navigate("Settings")} hitSlop={10}><Icon name="settings" size={22} style={styles.backIcon} /></Pressable>
        </View>
        <Animated.View style={[styles.content, { transform: [{ translateX: slideX }] }]}>
          <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} />
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
${ctx.appBody}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  ${baseStyleEntries(bp)}
  wizBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  progressWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(60,60,67,0.12)", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "${lit(bp.accent)}" },
});
`;
}

/* ===================== deterministic standard screens ===================== */
/* Settings + Privacy/Terms/Support are rendered from templates (never the LLM)
 * so every app always has them, every button works, and they stay tap-to-edit
 * friendly (literal copy). Tailoring comes from the app's docs + support email. */

/** Render text that is safe as a JSX child. Plain copy stays a literal (so it's
 * tap-to-edit-able); anything with JSX-significant chars becomes a string expr. */
function jsxText(s: string): string {
  return /[{}<>&]/.test(s) ? `{${JSON.stringify(s)}}` : s;
}

/** A scrollable document screen (Privacy / Terms / Support) from a Doc. */
export function renderLegalScreen(screenId: string, doc: Doc): string {
  const blocks = doc.sections
    .map(
      (sec) =>
        `        <Text style={styles.heading}>${jsxText(sec.heading)}</Text>\n` +
        `        <Text style={styles.body}>{${JSON.stringify(sec.body)}}</Text>`,
    )
    .join("\n");

  return `import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../../ui";

export default function ${screenId}({ navigate, goBack, params }) {
  return (
    <Screen largeTitle="${lit(doc.title)}">
      <View style={styles.wrap}>
${blocks}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 4 },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginTop: 22,
    marginBottom: 6,
  },
  body: { fontSize: 16, lineHeight: 23, color: "#3C3C43" },
});
`;
}

/** The Settings screen: a working toggle, legal links, support email, and a
 * functional Delete Account control — present in every generated app. */
export function renderSettingsScreen(
  screenId: string,
  supportEmail: string,
  hasRoles = false,
): string {
  const roleImport = hasRoles ? ", resetRole" : "";
  const switchRoleSection = hasRoles
    ? `
      <GroupedSection header="Account" footer="Switch which side of the app you're using.">
        <SettingsRow label="Switch role" icon="swap-horizontal" onPress={() => resetRole()} isLast />
      </GroupedSection>
`
    : "";
  return `import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { Screen, GroupedSection, SettingsRow, AppButton, appAlert, resetAppData${roleImport} } from "../../ui";

export default function ${screenId}({ navigate, goBack, params }) {
  const [notifications, setNotifications] = useState(true);

  const confirmDelete = () =>
    appAlert(
      "Delete Account?",
      "This permanently deletes your account and all of your data on this device. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            resetAppData();
            appAlert("Account deleted", "Your account and data have been removed from this device.");
          },
        },
      ],
    );

  return (
    <Screen largeTitle="Settings">
      <GroupedSection header="Preferences">
        <SettingsRow label="Notifications" icon="notifications" toggle={notifications} onToggle={setNotifications} isLast />
      </GroupedSection>

      <GroupedSection header="About & Legal">
        <SettingsRow label="Privacy Policy" icon="lock-closed" onPress={() => navigate("PrivacyPolicy")} />
        <SettingsRow label="Terms of Service" icon="document-text" onPress={() => navigate("TermsOfService")} />
        <SettingsRow label="Support" icon="help-circle" onPress={() => navigate("Support")} isLast />
      </GroupedSection>

      <GroupedSection header="Contact" footer="Tap the address to set your own support email.">
        <SettingsRow label="Support email" value="${lit(supportEmail)}" icon="mail" isLast />
      </GroupedSection>
${switchRoleSection}
      <View style={styles.account}>
        <AppButton title="Delete Account" variant="destructive" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  account: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
});
`;
}

/** Pick the right deterministic template for a standard screen, or null. */
export function renderStandardScreen(
  screen: BlueprintScreen,
  docs: AppDocs,
  supportEmail: string,
  hasRoles = false,
): string | null {
  switch (screen.id) {
    case "Settings":
      return renderSettingsScreen(screen.id, supportEmail, hasRoles);
    case "PrivacyPolicy":
      return renderLegalScreen(screen.id, docs.privacy);
    case "TermsOfService":
      return renderLegalScreen(screen.id, docs.terms);
    case "Support":
      return renderLegalScreen(screen.id, docs.support);
    default:
      return null;
  }
}

/** A minimal valid screen, used when a screen's codegen keeps failing. */
export function placeholderScreen(screen: BlueprintScreen): string {
  return `import React from "react";
import { Screen, GroupedSection, SettingsRow } from "../../ui";

export default function ${screen.id}() {
  return (
    <Screen largeTitle="${lit(screen.title)}">
      <GroupedSection header="Coming together">
        <SettingsRow label="This screen is being set up" />
      </GroupedSection>
    </Screen>
  );
}
`;
}
