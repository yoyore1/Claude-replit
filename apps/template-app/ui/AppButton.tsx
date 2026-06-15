import React, { useRef } from "react";
import { Animated, Pressable, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, radius, type } from "./tokens";

type Variant = "primary" | "secondary" | "destructive";

/**
 * iOS button. primary = filled rounded-rect (50pt, 17pt semibold, app tint),
 * secondary = tint TEXT button (never bordered — bordered reads Android),
 * destructive = red text. Press = opacity + spring scale + light haptic.
 */
export function AppButton({
  title = "Button",
  onPress,
  variant = "primary",
  disabled,
  style,
  titleStyle,
}: {
  title?: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Per-instance tap-to-edit overrides: `style.backgroundColor` tints THIS
   * button's box; `titleStyle` recolors its title text. */
  style?: any;
  titleStyle?: any;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();

  const isPrimary = variant === "primary";
  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        spring(0.97);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => spring(1)}
      onPress={onPress}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      <Animated.View
        style={[
          styles.base,
          isPrimary ? styles.primary : styles.bare,
          { transform: [{ scale }] },
          style,
        ]}
      >
        <Text
          {...tapField("title")}
          style={[
            styles.label,
            isPrimary && { color: "#FFFFFF" },
            variant === "secondary" && { color: colors.tint },
            variant === "destructive" && { color: colors.destructive },
            titleStyle,
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.tint },
  bare: { backgroundColor: "transparent" },
  label: { ...type.headline, color: colors.label },
});
