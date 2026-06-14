import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { Icon } from "./Icon";
import { colors, hairline, spacing, type } from "./tokens";

/**
 * A 44pt grouped row with an inset hairline separator and a chevron when
 * navigable — the canonical iOS list row. `label`/`value` are tap-editable props.
 */
export function SettingsRow({
  label = "Label",
  value,
  icon,
  iconColor = colors.tint,
  onPress,
  toggle,
  onToggle,
  isLast,
}: {
  label?: string;
  value?: string;
  icon?: string;
  iconColor?: string;
  onPress?: () => void;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  isLast?: boolean;
}) {
  const Container: any = onPress ? Pressable : View;
  return (
    <Container
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        pressed ? { backgroundColor: colors.fill } : null,
      ]}
    >
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconColor }]}>
          <Icon name={icon} size={17} color="#FFFFFF" />
        </View>
      ) : null}

      <Text {...tapField("label")} style={styles.label} numberOfLines={1}>
        {label}
      </Text>

      <View style={{ flex: 1 }} />

      {value != null ? (
        <Text {...tapField("value")} style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}

      {toggle != null ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          trackColor={{ true: colors.success, false: undefined as any }}
          style={{ marginLeft: 8 }}
        />
      ) : null}

      {onPress ? (
        <Icon
          name="chevron-forward"
          size={18}
          color={colors.tertiaryLabel}
          style={{ marginLeft: 6 }}
        />
      ) : null}

      {!isLast ? <View style={styles.sep} /> : null}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.h,
    paddingVertical: 8,
    backgroundColor: colors.systemBackground,
  },
  iconWrap: {
    width: 29,
    height: 29,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  label: { ...type.body, color: colors.label },
  value: { ...type.body, color: colors.secondaryLabel },
  sep: {
    position: "absolute",
    left: spacing.h,
    right: 0,
    bottom: 0,
    height: hairline,
    backgroundColor: colors.separator,
  },
});
