import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Icon } from "./Icon";
import { colors, radius, spacing, type } from "./tokens";

/** iOS rounded grey search field with a leading magnifier. */
export function SearchField({
  placeholder = "Search",
  value,
  onChangeText,
}: {
  placeholder?: string;
  value?: string;
  onChangeText?: (t: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Icon name="search" size={17} color={colors.secondaryLabel} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryLabel as any}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        maxFontSizeMultiplier={1.4}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.fill,
    borderRadius: radius.field,
    paddingHorizontal: 8,
    height: 36,
    marginHorizontal: spacing.h,
  },
  input: { flex: 1, ...type.body, color: colors.label, outlineStyle: "none" } as any,
});
