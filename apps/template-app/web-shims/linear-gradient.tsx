import React from "react";
import { View } from "react-native";

// Web shim for expo-linear-gradient using a CSS gradient.
export function LinearGradient({
  colors = ["#000000", "#ffffff"],
  start,
  end,
  style,
  children,
  ...rest
}: any) {
  // Approximate the start/end direction as a CSS angle (default top→bottom).
  let angle = "180deg";
  if (start && end) {
    const dx = (end.x ?? 0) - (start.x ?? 0);
    const dy = (end.y ?? 1) - (start.y ?? 0);
    angle = `${Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90)}deg`;
  }
  const bg = `linear-gradient(${angle}, ${colors.join(", ")})`;
  return (
    <View
      {...rest}
      style={[
        style,
        // @ts-expect-error web-only style key
        { backgroundImage: bg },
      ]}
    >
      {children}
    </View>
  );
}
