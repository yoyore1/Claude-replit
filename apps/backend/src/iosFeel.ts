/**
 * The condensed iOS-feel rules + kit contract injected into the build and AI-edit
 * prompts so every generated app feels like premium native iOS — and stays fully
 * tap-to-edit-able (text as literals / kit props, colors as literals/tokens).
 */
export const IOS_FEEL_PROMPT = `
PREMIUM NATIVE iOS — make it indistinguishable from an app built in Xcode. Never Android, never AI-slop.

USE THE KIT (import from "./ui") — do NOT reinvent these, and do NOT install packages:
  Screen, GroupedSection, SettingsRow, SegmentedControl, SearchField, AppButton, Sheet, Icon,
  appAlert, actionMenu, share, and tokens: colors, type, spacing, radius.
- Each screen's root is <Screen largeTitle="...">. Lists use <GroupedSection header="..."><SettingsRow .../></GroupedSection>.
- Actions use <AppButton title="..." />. Dialogs use appAlert(...) / actionMenu(...). Sheets use <Sheet/>.

TAP-TO-EDIT (critical — keep edits working):
- Copy goes in tap-editable PROPS of kit components (label, value, title, header, footer, largeTitle, placeholder).
- For custom content, author PLAIN literal text inside <Text>Hello</Text> (never built from variables/template strings for static copy).
- Colors are literals "#rrggbb" or tokens (colors.x) in StyleSheet / inline style objects — never computed at runtime.
- REUSED ROWS/CARDS — independence rule (critical): if you render the SAME custom component for several visible items (a CheckRow, StepperRow, ProductCard…), it MUST be built so each instance edits on its own, or editing one changes ALL of them (they share one source line). Two safe options:
    1) PREFER the kit: use <SettingsRow label=".." value=".."/> inside <GroupedSection> — already independently editable.
    2) If you must write a custom repeated component, follow the kit pattern EXACTLY:
       - accept \`style\`, and a \`<field>Style\` prop for each text (e.g. \`labelStyle\`, \`valueStyle\`),
       - spread \`style\` on the ROOT view (so the box background edits per instance),
       - render each text from a prop named title/label/value/text/heading/subtitle/caption, marked with tapField and merging its style:
           import { tapField } from "../../ui";
           function PriceRow({ label, value, style, labelStyle, valueStyle }) {
             return (
               <View style={[styles.row, style]}>
                 <Text {...tapField("label")} style={[styles.label, labelStyle]}>{label}</Text>
                 <Text {...tapField("value")} style={[styles.value, valueStyle]}>{value}</Text>
               </View>
             );
           }
       - keep base colors literal in the StyleSheet. NEVER hardcode a literal in the rendered text (write {label}, not "Bananas") — a hardcoded literal in a reused component makes every instance show the same edited text.
  A single-use custom component (rendered once) needs none of this. For a FIXED set rendered inline (no component), each element already has its own source line and is independent.
- INDEPENDENT EDITS — every visible item must be its OWN element with its OWN literal, so tapping one edits ONLY that one. For a FIXED, known set of items (tabs, folders, menu/list rows, feature cards, nav items) DO NOT use .map()/loops/arrays — write each item out as a separate element with literal copy. Example: write four rows
    <SettingsRow label="Personal" .../>
    <SettingsRow label="Work" .../>
    <SettingsRow label="Ideas" .../>
    <SettingsRow label="Travel" .../>
  NOT  {["Personal","Work","Ideas","Travel"].map(f => <SettingsRow label={f} .../>)}  and NEVER a hardcoded literal inside .map() (e.g. label="Person") — that makes every row share one source line, so one edit changes them all.
- Only use .map() for data the USER adds/changes at RUNTIME (e.g. notes they create). There, bind the prop to the item (label={item.title}, value={item.date}) — never a shared hardcoded literal — since runtime data is edited in-app, not by tapping source.

iOS STRUCTURE (from tokens):
- Apple type scale via \`type\` (Body 17pt; large title 34pt bold). System font for functional UI; display font only on heroes.
- Text colors via \`colors\` (label / secondaryLabel / tertiaryLabel). Background fits THE APP's vibe — do NOT force grey.
- Grouped sections, 44pt rows, INSET hairline separators, chevrons on navigable rows. Touch targets 44pt, 16pt margins.
- iOS accents: success #34C759, destructive #FF3B30; the app's primary is the dominant tint.

HARD BANS (Android tells — never emit):
- No TouchableNativeFeedback / ripple. No FABs. No \`elevation:\` or heavy drop shadows. No top/material tabs, drawers, hamburger menus.
- No Material icons. No Android toasts/snackbars. No outlined/floating-label inputs. No ALL-CAPS button labels (sentence case, 17pt semibold).

FEEL: press feedback = opacity/scale; spring motion; restrained. When unsure, copy Apple's own app (Settings for lists, App Store for cards, Messages for inputs).
`.trim();

/**
 * The contract for generating ONE screen of a multi-screen app. Injected into the
 * per-screen codegen prompt on top of IOS_FEEL_PROMPT. The navigation shell
 * (App.tsx) is assembled separately, so each screen is a self-contained component
 * that receives navigation via props — it never imports other screens or wires nav.
 */
export const SCREEN_CONTRACT = `
YOU ARE WRITING ONE SCREEN of a larger multi-screen app. Output ONLY this one file.

FILE SHAPE (exactly):
- import React, { useState } from "react";
- import the RN primitives you use from "react-native" (View, Text, Pressable, Image, StyleSheet).
- import kit pieces from "../../ui" (NOT "./ui") — e.g. import { Screen, GroupedSection, SettingsRow, AppButton, SegmentedControl, SearchField, Sheet, Icon, appAlert, actionMenu, colors, type, spacing, radius } from "../../ui";
- export default function <ScreenId>({ navigate, goBack, params }) { ... }
- The component's ROOT must be <Screen largeTitle="...">. Screen already scrolls — do NOT wrap it in your own ScrollView.

ICONS — use the <Icon name="..."/> kit piece with VALID Ionicons names only:
- Good: chevron-forward, chevron-back, add, remove, checkmark, checkmark-circle, close, search, ellipsis-horizontal, heart, heart-outline, star, star-outline, cart, calendar, restaurant, settings, person, people, notifications, mail, cash, card, trash, create, time, location, sparkles.
- NEVER use SF Symbols (e.g. "fork.knife.circle.fill"), Material names ("md-*"), or web names ("chevron-left", "chevron-right", "plus", "minus", "bell", "dollar", "trash-2"). Prefer the "-outline" variant for line style.

NAVIGATION (the only cross-screen API):
- To open another screen (e.g. a detail view), call navigate("OtherScreenId", { any: "params" }) from an onPress.
- A detail screen reads its input from the \`params\` prop and can call goBack().
- Do NOT import other screen files and do NOT build your own tab bar or back button — the shell handles that.

Keep ALL the tap-to-edit rules above: literal <Text> copy, literal "#rrggbb" colors, one element per visible item (no .map() for fixed sets). Make this single screen rich, polished, and genuinely useful.
`.trim();

/** Cheap local audit for Android-isms / banned patterns. Non-fatal warnings. */
export function auditIosFeel(code: string): string[] {
  const checks: { re: RegExp; msg: string }[] = [
    { re: /TouchableNativeFeedback/, msg: "Android ripple (TouchableNativeFeedback)" },
    { re: /\belevation\s*:/, msg: "Android elevation shadow" },
    { re: /\bFAB\b|FloatingActionButton/, msg: "floating action button (FAB)" },
    { re: /createMaterialTopTabNavigator|MaterialTopTabs/, msg: "Material top tabs" },
    { re: /createDrawerNavigator|DrawerLayout/, msg: "drawer / hamburger menu" },
    { re: /textTransform\s*:\s*["']uppercase["']/, msg: "ALL-CAPS text (uppercase)" },
    { re: /name=["']md-/, msg: "Material icon name (md-*)" },
    { re: /name=["'][a-z]+\.[a-z.]+["']/, msg: "SF Symbols icon name (foo.bar.fill)" },
    { re: /name=["'](chevron-(left|right)|plus|minus|bell|dollar|trash-2)["']/, msg: "non-Ionicons icon name (web/material variant)" },
  ];
  return checks.filter((c) => c.re.test(code)).map((c) => c.msg);
}
