import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./tokens";
import { textColor } from "./overrides";

// The model often emits icon names that aren't valid Ionicons: SF Symbols
// (fork.knife.circle.fill), web/material names (chevron-left, plus, trash-2),
// or plain words (bell, dollar, truck). Map those onto real Ionicons names so
// icons render on device instead of showing the missing-glyph box. Anything
// already valid passes straight through.
const ALIAS: Record<string, string> = {
  // chevrons / arrows
  "chevron-left": "chevron-back",
  "chevron-right": "chevron-forward",
  back: "chevron-back",
  forward: "chevron-forward",
  "arrow-left": "arrow-back",
  "arrow-right": "arrow-forward",
  // add / remove
  plus: "add",
  "plus-circle": "add-circle",
  minus: "remove",
  "minus-circle": "remove-circle",
  // common words
  bell: "notifications",
  "bell-outline": "notifications-outline",
  dollar: "cash",
  "dollar-sign": "cash",
  money: "cash",
  truck: "car",
  delivery: "car",
  question: "help-circle",
  help: "help-circle",
  info: "information-circle",
  user: "person",
  users: "people",
  profile: "person-circle",
  edit: "create",
  pencil: "create",
  delete: "trash",
  "trash-2": "trash",
  gear: "settings",
  cog: "settings",
  sparkle: "sparkles",
  sun: "sunny",
  food: "restaurant",
  meal: "restaurant",
  grocery: "cart",
  basket: "cart",
  // SF Symbols → Ionicons (strip the .fill/.circle suffixes the model copies)
  "fork.knife.circle.fill": "restaurant",
  "fork.knife": "restaurant",
  "cart.fill": "cart",
  "house.fill": "home",
  "person.fill": "person",
  "gearshape.fill": "settings",
  "star.fill": "star",
  "heart.fill": "heart",
  "plus.circle.fill": "add-circle",
  "checkmark.circle.fill": "checkmark-circle",
};

function normalize(name: string): string {
  if (ALIAS[name]) return ALIAS[name];
  // Generic SF Symbols fallback: "foo.bar.fill" -> "foo"
  if (name.includes(".")) {
    const base = name.split(".")[0];
    if (ALIAS[base]) return ALIAS[base];
    return base;
  }
  return name;
}

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
  return (
    <Ionicons name={normalize(name) as any} size={size} color={tint} style={style} />
  );
}

export { Ionicons };
