import React, { useEffect, useRef } from "react";
import { Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, spacing, type } from "./tokens";

/**
 * Screen wrapper: app-matched background, optional large title, one shared
 * entrance pattern (staggered fade-up), and iOS scroll feel (interactive keyboard
 * dismiss, automatic inset adjustment, rubber-band bounce).
 */
export function Screen({
  children,
  background,
  largeTitle,
  scroll = true,
  style,
  largeTitleStyle,
}: {
  children: React.ReactNode;
  background?: string;
  largeTitle?: string;
  scroll?: boolean;
  /**
   * Per-instance tap-to-edit overrides written by the codemod for THIS screen:
   * `style.backgroundColor` repaints the background, `largeTitleStyle` recolors
   * the large title. Tokens are never mutated.
   */
  style?: any;
  largeTitleStyle?: any;
}) {
  const override = StyleSheet.flatten(style) || {};
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 40,
    }).start();
  }, [t]);

  const bg = override.backgroundColor ?? background ?? colors.secondaryBackground;
  const inner = (
    <Animated.View
      style={{
        opacity: t,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      {largeTitle ? (
        <Text {...tapField("largeTitle")} style={[styles.large, largeTitleStyle]}>
          {largeTitle}
        </Text>
      ) : null}
      {children}
    </Animated.View>
  );

  if (!scroll) {
    return <View style={[styles.root, { backgroundColor: bg }]}>{inner}</View>;
  }
  return (
    <ScrollView
      style={[styles.root, { backgroundColor: bg }]}
      contentContainerStyle={styles.content}
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      bounces
    >
      {inner}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingTop: 12, paddingBottom: 48 },
  large: {
    ...type.largeTitle,
    color: colors.label,
    paddingHorizontal: spacing.h,
    paddingTop: 8,
    paddingBottom: 8,
  },
});
