import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, radius, spacing, type } from "./tokens";

/**
 * The iOS Settings "inset grouped" look: an optional header/footer in secondary
 * footnote text, with rows inside a rounded card on the app's background.
 */
export function GroupedSection({
  header,
  footer,
  children,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      {header ? (
        <Text {...tapField("header")} style={styles.header}>
          {header}
        </Text>
      ) : null}
      <View style={styles.group}>{children}</View>
      {footer ? (
        <Text {...tapField("footer")} style={styles.footer}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.section },
  header: {
    ...type.footnote,
    color: colors.secondaryLabel,
    marginHorizontal: spacing.h + 4,
    marginBottom: 7,
  },
  group: {
    backgroundColor: colors.systemBackground,
    borderRadius: radius.card,
    marginHorizontal: spacing.h,
    overflow: "hidden",
  },
  footer: {
    ...type.footnote,
    color: colors.secondaryLabel,
    marginHorizontal: spacing.h + 4,
    marginTop: 7,
  },
});
