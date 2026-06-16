// The premium-iOS kit. Generated screens import from here ("./ui").
// These components are infrastructure (web fallbacks baked in); tap-to-edit works
// on the screens that use them via tapField-marked props.
export * from "./tokens";
export { Icon, Ionicons } from "./Icon";
export { Screen } from "./Screen";
export { AppButton } from "./AppButton";
export { GroupedSection } from "./GroupedSection";
export { SettingsRow } from "./SettingsRow";
export { SegmentedControl } from "./SegmentedControl";
export { SearchField } from "./SearchField";
export { Sheet } from "./Sheet";
export { appAlert, actionMenu, share } from "./native";
export type { AlertButton } from "./native";
// Mark a custom component's prop-driven <Text> so tap-to-edit resolves to THIS
// instance (each row edits independently). See SettingsRow for the pattern.
export { tapField } from "@cr/tap-edit-runtime";
