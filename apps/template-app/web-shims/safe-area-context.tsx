import React from "react";
import { View } from "react-native";

// Web shim for react-native-safe-area-context. The browser preview has no
// notch / home indicator, so insets are all 0 and SafeAreaView is a plain View.
// On a real device the native package provides the actual insets.

export const SafeAreaInsetsContext = React.createContext({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export function SafeAreaProvider({ children, ...rest }: any) {
  return <View {...rest}>{children}</View>;
}

export function SafeAreaView({ children, ...rest }: any) {
  return <View {...rest}>{children}</View>;
}

export function useSafeAreaInsets() {
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 0, height: 0 };
}
