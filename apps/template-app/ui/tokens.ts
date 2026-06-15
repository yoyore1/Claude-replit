import { Platform, StyleSheet } from "react-native";
import * as RN from "react-native";

/**
 * Design tokens — the foundation of the premium-iOS look.
 *
 * - Apple type scale (Body is 17pt, large title 34pt bold).
 * - Semantic colors via PlatformColor on iOS, with web/Android hex fallbacks,
 *   so text/separators auto-adapt to dark mode on device.
 * - hairline separators, NO elevation. Each app paints its own background;
 *   structure (not a grey background) is what makes it feel iOS.
 */

function sys(iosName: string, fallback: string): string {
  // PlatformColor is only meaningful on iOS; elsewhere use the fallback. The
  // computed key (not a static `.PlatformColor`) keeps the web bundler from
  // trying to resolve an export react-native-web doesn't have.
  if (Platform.OS === "ios") {
    const fn = (RN as any)["Platform" + "Color"];
    if (typeof fn === "function") return fn(iosName) as unknown as string;
  }
  return fallback;
}

export const colors = {
  label: sys("label", "#000000"),
  secondaryLabel: sys("secondaryLabel", "rgba(60,60,67,0.6)"),
  tertiaryLabel: sys("tertiaryLabel", "rgba(60,60,67,0.3)"),
  separator: sys("separator", "rgba(60,60,67,0.29)"),
  systemBackground: sys("systemBackground", "#FFFFFF"),
  secondaryBackground: sys("secondarySystemBackground", "#F2F2F7"),
  fill: sys("tertiarySystemFill", "rgba(118,118,128,0.12)"),
  /** App tint / primary action color (override per app via ThemeProvider). */
  tint: "#007AFF",
  /** iOS semantic accents — keep these true where used. */
  success: "#34C759",
  destructive: "#FF3B30",
};

/** Apple type scale. fontWeight uses regular/semibold/bold only. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" as const },
  title1: { fontSize: 28, fontWeight: "700" as const },
  title2: { fontSize: 22, fontWeight: "700" as const },
  headline: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 17, fontWeight: "400" as const },
  callout: { fontSize: 16, fontWeight: "400" as const },
  subhead: { fontSize: 15, fontWeight: "400" as const },
  footnote: { fontSize: 13, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};

export const radius = {
  card: 12, button: 14, sheet: 12, field: 10,
  // Conventional aliases used by generated screens
  sm: 6, md: 12, lg: 16, xl: 20, full: 9999,
};
export const spacing = {
  h: 16, gap: 12, section: 20,
  // Conventional aliases used by generated screens
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
};
export const hairline = StyleSheet.hairlineWidth;

/** System font for functional UI (SF Pro on iOS). Display font is per-app. */
export const systemFont = Platform.select({ ios: "System", default: undefined });

/** Cap Dynamic Type so scaling never breaks dense layouts. */
export const maxFontScale = 1.4;
