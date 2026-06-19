import React from "react";
import { View } from "react-native";

/**
 * Web shim for expo-glass-effect (iOS-26-only native module). In the browser
 * preview there is no real Liquid Glass, so GlassView renders a frosted view via
 * CSS backdrop-filter (matching the BlurView shim) and the availability checks
 * report false — so the kit's GlassPanel takes its cross-platform BlurView path.
 */
export function GlassView({
  tintColor,
  glassEffectStyle,
  colorScheme,
  isInteractive,
  style,
  children,
  ...rest
}: any) {
  const blur = "saturate(180%) blur(18px)";
  return (
    <View
      {...rest}
      style={[
        style,
        {
          backgroundColor: tintColor ?? "rgba(255,255,255,0.55)",
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        } as any,
      ]}
    >
      {children}
    </View>
  );
}

export function GlassContainer({ style, children, ...rest }: any) {
  return (
    <View {...rest} style={style}>
      {children}
    </View>
  );
}

export function isLiquidGlassAvailable(): boolean {
  return false;
}
export function isGlassEffectAPIAvailable(): boolean {
  return false;
}
