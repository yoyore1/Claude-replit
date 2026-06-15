import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, type } from "./tokens";
import { boxBg, textColor } from "./overrides";

/** iOS pill-in-track segmented control for switching views. */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  style,
}: {
  options?: string[];
  value?: string | number;
  onChange?: (option: string, index: number) => void;
  /** Per-instance tap-to-edit overrides: `style.backgroundColor` tints the
   * track, `style.color` recolors the segment labels. */
  style?: any;
}) {
  const segText = textColor(style);
  return (
    <View style={[styles.track, boxBg(style)]}>
      {options.map((opt, i) => {
        const active = value === opt || value === i;
        return (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              onChange?.(opt, i);
            }}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.text, active && styles.textActive, segText]}>
              {opt}
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
