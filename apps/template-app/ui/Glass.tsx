import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { radius, spacing } from "./tokens";
import { boxBg } from "./overrides";

/**
 * Frosted "Liquid Glass" surface — the premium-iOS material.
 *
 * HYBRID: on iOS 26 (where the real Liquid Glass API exists) it renders the
 * native <GlassView>; everywhere else (older iOS, Android, Expo Go, and the web
 * preview) it falls back to expo-blur's <BlurView>, which is frosted glass via
 * CSS backdrop-filter on web. So it always looks good and looks BEST on new
 * iPhones — see the plan's "honest limits".
 *
 * TAP-TO-EDIT: this is a plain kit component, so each use in a screen keeps its
 * own __tapSource (selectable / movable). A tap-to-edit `style.backgroundColor`
 * override becomes the glass TINT (native: tintColor; fallback: a translucent
 * overlay), reusing the existing backgroundColor edit kind — no new edit needed.
 * Text placed inside stays editable as normal.
 */

// Detect the real Liquid Glass API once. Guarded so it can never crash Expo Go,
// where the native module may be absent (then we just use the BlurView path).
const LIQUID_GLASS = (() => {
  try {
    return (
      Platform.OS === "ios" &&
      typeof isLiquidGlassAvailable === "function" &&
      isLiquidGlassAvailable()
    );
  } catch {
    return false;
  }
})();

export function GlassPanel({
  children,
  style,
  tint = "light",
  intensity = 50,
  glassEffectStyle = "regular",
  ...rest
}: {
  children?: React.ReactNode;
  /** Per-instance tap-to-edit override: `style.backgroundColor` sets the tint. */
  style?: any;
  tint?: "light" | "dark" | "default" | "prominent" | "regular";
  intensity?: number;
  glassEffectStyle?: "clear" | "regular" | "none";
  [key: string]: any;
}) {
  const override = boxBg(style); // { backgroundColor } | null

  if (LIQUID_GLASS && GlassView) {
    return (
      <GlassView
        glassEffectStyle={glassEffectStyle}
        tintColor={override?.backgroundColor}
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint as any} style={style} {...rest}>
      {override ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: override.backgroundColor, opacity: 0.55 },
          ]}
        />
      ) : null}
      {children}
    </BlurView>
  );
}

/** A GlassPanel pre-styled as a rounded, padded card. */
export function GlassCard({ children, style, ...rest }: any) {
  return (
    <GlassPanel style={[styles.card, style]} {...rest}>
      {children}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.h,
    overflow: "hidden",
  },
});
