import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./tokens";
import { textColor } from "./overrides";

// iOS line-icons. Use Ionicons names (chevron-forward, ellipsis-horizontal…).
export function Icon({
  name,
  size = 22,
  color = colors.label,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}) {
  // A tap-to-edit color override arrives as `style={{ color }}`; Ionicons tints
  // by the `color` prop, so route it there.
  const tint = textColor(style)?.color ?? color;
  return <Ionicons name={name as any} size={size} color={tint} style={style} />;
}

export { Ionicons };
