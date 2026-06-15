import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, type } from "./tokens";
import { boxBg, textColor } from "./overrides";

type SegOption = string | { label?: string; value?: string | number };

/** iOS pill-in-track segmented control for switching views. */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  style,
}: {
  /** Plain strings, or `{ label, value }` objects — both are accepted. */
  options?: SegOption[];
  value?: string | number;
  onChange?: (option: string | number, index: number) => void;
  /** Per-instance tap-to-edit overrides: `style.backgroundColor` tints the
   * track, `style.color` recolors the segment labels. */
  style?: any;
}) {
  const segText = textColor(style);
  return (
    <View style={[styles.track, boxBg(style)]}>
      {options.map((opt, i) => {
        // Tolerate both string options and { label, value } objects, since the
        // generated code uses either. Rendering the raw object would crash.
        const isObj = opt !== null && typeof opt === "object";
        const label = isObj ? String((opt as any).label ?? (opt as any).value ?? "") : String(opt);
        const optValue = isObj ? (opt as any).value ?? (opt as any).label : opt;
        const active = value === optValue || value === i;
        return (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              onChange?.(optValue as any, i);
            }}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.text, active && styles.textActive, segText]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.fill,
    borderRadius: 9,
    padding: 2,
    marginHorizontal: 16,
  },
  seg: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 7,
  },
  segActive: {
    backgroundColor: colors.systemBackground,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  text: { ...type.subhead, color: colors.label },
  textActive: { fontWeight: "600" },
});
