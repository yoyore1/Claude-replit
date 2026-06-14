import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { tapField } from "@cr/tap-edit-runtime";
import { colors, radius, spacing, type } from "./tokens";

/**
 * iOS-style bottom sheet: slide-up with a grabber handle and rounded top corners.
 * Prefer this over full-screen takeovers. (Real pageSheet presentation is used
 * on device; the web preview uses a translucent backdrop + slide.)
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        {title ? (
          <Text {...tapField("title")} style={styles.title}>
            {title}
          </Text>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.secondaryBackground,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.h,
    paddingBottom: 32,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.tertiaryLabel,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    ...type.title2,
    color: colors.label,
    marginBottom: 12,
  },
});
