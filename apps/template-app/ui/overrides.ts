import { StyleSheet } from "react-native";

/**
 * Shared tap-to-edit override convention for the kit.
 *
 * The codemod writes per-instance overrides onto a component so each instance
 * stays independent (the shared StyleSheet/tokens are never mutated):
 *   - `style={{ backgroundColor }}`     → tints THIS component's box
 *   - `${field}Style={{ color }}`       → recolors THIS component's named text
 *     (e.g. `titleStyle`, `labelStyle`, `valueStyle`, `headerStyle`)
 *
 * Every kit component runs its incoming `style` through `boxBg` for its
 * container and each per-field `*Style` through `textColor` for that text, so
 * tap-to-edit color/background works the same way everywhere.
 */

/** backgroundColor override for an element's box, from a tap-to-edit `style`. */
export function boxBg(style: any): { backgroundColor: string } | null {
  const f = StyleSheet.flatten(style) || {};
  return f.backgroundColor != null
    ? { backgroundColor: f.backgroundColor as string }
    : null;
}

/** color override for a specific text, from a per-field `*Style` prop. */
export function textColor(style: any): { color: string } | null {
  const f = StyleSheet.flatten(style) || {};
  return f.color != null ? { color: f.color as string } : null;
}
