import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * A small demo screen. Everything here is editable by tapping it in the preview:
 * text content and colors update the source of THIS file via the codemod engine,
 * then the preview hot-reloads (Vite HMR on web / Metro Fast Refresh on device).
 * The tap-to-edit wrapper lives in the entry (web/main.tsx, index.js), not here.
 */
export default function App() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Good morning</Text>
          <Text style={styles.subtitle}>You have 3 tasks today</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Focus</Text>
            <Text style={styles.cardValue}>Ship the preview</Text>
          </View>

          <View style={[styles.card, { backgroundColor: "#1e293b" }]}>
            <Text style={[styles.cardLabel, { color: "#94a3b8" }]}>
              Up next
            </Text>
            <Text style={[styles.cardValue, { color: "#ffffff" }]}>
              Wire tap to edit
            </Text>
          </View>

          <View style={styles.button}>
            <Text style={styles.buttonText}>Get started</Text>
          </View>

          <Text style={styles.hint}>
            Tap any text or color in this preview to edit the code.
          </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 16,
    color: "#94a3b8",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#7c3aed",
    borderRadius: 16,
    padding: 20,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ede9fe",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 6,
  },
  button: {
    backgroundColor: "#22c55e",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#052e16",
  },
  hint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 12,
  },
});
