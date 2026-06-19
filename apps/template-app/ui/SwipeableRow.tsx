import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors, type } from "./tokens";

/**
 * iOS swipe-to-reveal-actions row. Swipe a row left to expose action buttons
 * (e.g. Delete / Archive), each wired to a real callback.
 *
 * Built on PanResponder (built into React Native + react-native-web) rather than
 * a native gesture library, so it works identically on device, in Expo Go, and
 * in the web preview — no GestureHandlerRootView or extra native config needed.
 *
 * TAP-TO-EDIT: wrap a normal row (e.g. <SettingsRow .../>) as the child; the
 * child keeps its own source line so its copy/colors stay editable as usual.
 */
export function SwipeableRow({
  children,
  actions = [],
  style,
}: {
  children: React.ReactNode;
  /** Revealed on left-swipe, e.g. [{ label: "Delete", color: "#FF3B30", onPress }]. */
  actions?: { label: string; color?: string; onPress?: () => void }[];
  style?: any;
}) {
  const tx = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const width = actions.length ? Math.max(80 * actions.length, 80) : 0;

  const slideTo = (to: number) =>
    Animated.spring(tx, {
      toValue: to,
      useNativeDriver: true,
      friction: 9,
      tension: 60,
    }).start();

  const close = () => {
    open.current = false;
    slideTo(0);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        actions.length > 0 &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        const base = open.current ? -width : 0;
        let next = base + g.dx;
        if (next > 0) next = 0;
        if (next < -width - 24) next = -width - 24;
        tx.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = open.current ? -width : 0;
        const shouldOpen = base + g.dx < -width / 2;
        open.current = shouldOpen;
        slideTo(shouldOpen ? -width : 0);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      {actions.length ? (
        <View style={styles.actions}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              style={[
                styles.action,
                { backgroundColor: a.color || colors.destructive },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                close();
                a.onPress && a.onPress();
              }}
            >
              <Text style={styles.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Animated.View
        style={[styles.front, { transform: [{ translateX: tx }] }, style]}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", overflow: "hidden" },
  front: { backgroundColor: colors.systemBackground },
  actions: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
  },
  action: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    ...type.subhead,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
