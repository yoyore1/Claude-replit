import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./tokens";

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
  return <Ionicons name={name as any} size={size} color={color} style={style} />;
}

export { Ionicons };
