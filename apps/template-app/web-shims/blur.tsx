import React from "react";
import { View } from "react-native";

// Web shim for expo-blur's BlurView — real frosted glass via CSS backdrop-filter
// so bars/sheets look genuinely iOS in the browser preview.
export function BlurView({
  tint = "light",
  intensity = 50,
  style,
  children,
  ...rest
}: any) {
  const dark = tint === "dark" || tint === "systemChromeMaterialDark";
  const bg = dark ? "rgba(20,20,22,0.72)" : "rgba(255,255,255,0.72)";
  const blur = `saturate(180%) blur(${Math.max(8, intensity / 3)}px)`;
  return (
    <View
      {...rest}
      style={[
        style,
        {
          backgroundColor: bg,
          // @ts-expect-error web-only style keys
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
        },
      ]}
    >
      {children}
    </View>
  );
}
