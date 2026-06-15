import React from "react";
import { Text } from "react-native";
// The REAL Ionicons font + its name→codepoint map, straight from the package
// that ships them. We load the actual webfont so the browser preview renders the
// genuine iOS vector glyphs — tintable, monochrome, identical to the device.
// No Unicode look-alikes, no emoji.
import glyphMap from "./Ionicons.glyphmap.json";
import ioniconsFontUrl from "./Ionicons.ttf?url";

// Inject the @font-face exactly once.
if (typeof document !== "undefined" && !document.getElementById("ionicons-font")) {
  const el = document.createElement("style");
  el.id = "ionicons-font";
  el.textContent = `@font-face{font-family:"Ionicons";src:url(${ioniconsFontUrl}) format("truetype");font-weight:normal;font-style:normal;font-display:block;}`;
  document.head.appendChild(el);
}

const MAP = glyphMap as Record<string, number>;

export function Ionicons({ name, size = 22, color = "#000", style }: any) {
  const code = MAP[name] ?? MAP[name?.replace(/-(sharp)$/, "")] ?? 0;
  const glyph = code ? String.fromCodePoint(code) : "";
  return (
    <Text
      // fontFamily is forced both before and after the caller's style so a
      // tap-to-edit `{ color }` override can't accidentally drop the font.
      style={[
        { fontFamily: "Ionicons", fontSize: size, color },
        style,
        { fontFamily: "Ionicons", fontSize: size },
      ]}
    >
      {glyph}
    </Text>
  );
}

export default { Ionicons };
