import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, spacing, type } from "./tokens";

/**
 * Screen wrapper: app-matched background, optional large title, one shared
 * entrance pattern (staggered fade-up), and iOS scroll feel (interactive keyboard
 * dismiss, automatic inset adjustment, rubber-band bounce).
 *
 * Premium-iOS touches:
 *  - the large title COLLAPSES on scroll into a compact centered inline title bar
 *    (the hallmark iOS navigation behavior),
 *  - optional pull-to-refresh via `onRefresh`.
 * The large title stays a tap-to-edit literal (`tapField("largeTitle")`).
 */
export function Screen({
  children,
  background,
  largeTitle,
  scroll = true,
  style,
  largeTitleStyle,
  onRefresh,
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
  /** Pull-to-refresh handler; when provided, the screen gets a RefreshControl. */
  onRefresh?: () => void | Promise<void>;
}) {
  const override = StyleSheet.flatten(style) || {};
  const bg = override.backgroundColor ?? background ?? colors.secondaryBackground;

  // Entrance settle.
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(t, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
      tension: 40,
    }).start();
  }, [t]);

  // Scroll-driven large-title collapse.
  const scrollY = useRef(new Animated.Value(0)).current;
  const titleScale = scrollY.interpolate({
    inputRange: [-120, 0, 64],
    outputRange: [1.06, 1, 0.86],
    extrapolate: "clamp",
  });
  const titleShift = scrollY.interpolate({
    inputRange: [0, 64],
    outputRange: [0, -6],
    extrapolate: "clamp",
  });
  const inlineOpacity = scrollY.interpolate({
    inputRange: [34, 72],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Pull-to-refresh.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = onRefresh
    ? () => {
        setRefreshing(true);
        Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
      }
    : undefined;

  const titleNode = largeTitle ? (
    <Animated.Text
      {...tapField("largeTitle")}
      style={[
        styles.large,
        largeTitleStyle,
        { transform: [{ scale: titleScale }, { translateY: titleShift }] },
      ]}
    >
      {largeTitle}
    </Animated.Text>
  ) : null;

  const inner = (
    <Animated.View
      style={{
        opacity: t,
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      {titleNode}
      {children}
    </Animated.View>
  );

  if (!scroll) {
    return <View style={[styles.root, { backgroundColor: bg }]}>{inner}</View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        bounces
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        refreshControl={
          handleRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
      >
        {inner}
      </Animated.ScrollView>

      {/* Compact inline title that cross-fades in as the large title collapses. */}
      {largeTitle ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.inlineBar, { opacity: inlineOpacity }]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
          <Text numberOfLines={1} style={styles.inlineTitle}>
            {largeTitle}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Extra bottom inset so content clears the floating frosted tab bar.
  content: { paddingTop: 12, paddingBottom: 104 },
  large: {
    ...type.largeTitle,
    color: colors.label,
    paddingHorizontal: spacing.h,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inlineBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  inlineTitle: {
    ...type.headline,
    color: colors.label,
  },
});
