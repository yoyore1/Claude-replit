import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, radius, spacing, type } from "./tokens";
import { boxBg, textColor } from "./overrides";

/**
 * The iOS Settings "inset grouped" look: an optional header/footer in secondary
 * footnote text, with rows inside a rounded card on the app's background.
 */
export function GroupedSection({
  header,
  footer,
  children,
  style,
  headerStyle,
  footerStyle,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  /** Per-instance tap-to-edit overrides: `style.backgroundColor` tints the card;
   * `headerStyle` / `footerStyle` recolor the header / footer text. */
  style?: any;
  headerStyle?: any;
  footerStyle?: any;
}) {
  return (
    <View style={styles.wrap}>
      {header ? (
        <Text {...tapField("header")} style={[styles.header, textColor(headerStyle)]}>
          {header}
        </Text>
      ) : null}
      <View style={[styles.group, boxBg(style)]}>{children}</View>
      {footer ? (
        <Text {...tapField("footer")} style={[styles.footer, textColor(footerStyle)]}>
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
