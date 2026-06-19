// The premium-iOS kit. Generated screens import from here ("./ui").
// These components are infrastructure (web fallbacks baked in); tap-to-edit works
// on the screens that use them via tapField-marked props.
export * from "./tokens";
export { Icon, Ionicons } from "./Icon";
export { Screen } from "./Screen";
export { AppButton } from "./AppButton";
export { GlassPanel, GlassCard } from "./Glass";
export { GroupedSection } from "./GroupedSection";
export { SettingsRow } from "./SettingsRow";
export { SwipeableRow } from "./SwipeableRow";
export { SegmentedControl } from "./SegmentedControl";
export { SearchField } from "./SearchField";
export { Sheet } from "./Sheet";
export { appAlert, actionMenu, share } from "./native";
export type { AlertButton } from "./native";
// Mark a custom component's prop-driven <Text> so tap-to-edit resolves to THIS
// instance (each row edits independently). See SettingsRow for the pattern.
export { tapField } from "@cr/tap-edit-runtime";
// Real, persisted, shared app data: <StoreProvider> at the root + useEntity() in
// screens. Lets generated apps store and mutate data, not just render samples.
export { StoreProvider, useEntity, resetAppData, resetRole } from "./store";
export type { EntityApi } from "./store";
// Device capabilities (camera/photo, reminders, location, motion) with simple,
// safe wrappers that work on device and in the web preview.
export {
  pickImage,
  scheduleReminder,
  cancelReminder,
  useLocation,
  useMotion,
} from "./device";
export type { Coords } from "./device";
// Internet + AI: fetch any public API (proxied), call the model, generate images,
// transcribe audio, embeddings, and RAG over your own docs.
export {
  apiGet,
  apiPost,
  askAI,
  classifyImage,
  apiBase,
  generateImage,
  transcribe,
  embed,
  indexDoc,
  askDocs,
  setAppId,
} from "./net";
// Voice: speak text aloud (TTS) and record + transcribe the mic (STT).
export { speak, useVoiceInput } from "./media";
