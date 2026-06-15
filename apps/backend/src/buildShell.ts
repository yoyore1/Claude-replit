import type { Blueprint, BlueprintScreen } from "./architect.js";

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

export function renderAppShell(bp: Blueprint): string {
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

  const tabBarInner = showTabBar
    ? `        <SafeAreaView edges={["bottom"]} style={styles.tabBar}>
${tabButtons}
        </SafeAreaView>`
    : "";

  const tabBarSection = showTabBar
    ? `      {stack.length === 0 ? (
${tabBarInner}
      ) : null}`
    : "";

  return `import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors } from "./ui";
${imports}

// Pin the UI kit's tint to this app's accent color.
colors.tint = "${lit(bp.accent)}";

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

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {stack.length > 0 ? (
        <Pressable style={styles.backRow} onPress={goBack}>
          <Icon name="chevron-back" size={26} style={styles.backIcon} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.content}>
        <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} />
      </View>
${tabBarSection}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "${lit(bp.background)}" },
  content: { flex: 1 },
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
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.29)",
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
