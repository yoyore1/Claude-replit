import React from "react";
import { Text } from "react-native";

// Web shim for @expo/vector-icons Ionicons — maps the common iOS line-icon names
// to glyphs so the preview shows iOS-style chevrons/symbols without the font.
const GLYPHS: Record<string, string> = {
  "chevron-forward": "›",
  "chevron-back": "‹",
  "chevron-down": "⌄",
  "chevron-up": "⌃",
  "ellipsis-horizontal": "⋯",
  add: "+",
  search: "⌕",
  close: "✕",
  checkmark: "✓",
  "checkmark-circle": "✓",
  "heart-outline": "♡",
  heart: "♥",
  "star-outline": "☆",
  star: "★",
  "home-outline": "⌂",
  home: "⌂",
  "settings-outline": "⚙",
  settings: "⚙",
  "person-outline": "‍◯",
  person: "●",
  "notifications-outline": "◔",
  share: "↑",
  "share-outline": "↑",
  trash: "🗑",
  "arrow-back": "‹",
};

export function Ionicons({ name, size = 22, color = "#000", style }: any) {
  return (
    <Text
      style={[
        { fontSize: size, color, lineHeight: size * 1.15, textAlign: "center" },
        style,
      ]}
    >
      {GLYPHS[name] ?? "•"}
    </Text>
  );
}

export default { Ionicons };
