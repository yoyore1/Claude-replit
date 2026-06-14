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
  ];
  return checks.filter((c) => c.re.test(code)).map((c) => c.msg);
}
