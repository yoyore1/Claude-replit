import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors } from "./ui";
import MealPlan from "./src/screens/MealPlan";
import MealDetail from "./src/screens/MealDetail";
import GroceryList from "./src/screens/GroceryList";
import RecipeIdeas from "./src/screens/RecipeIdeas";
import RecipeDetail from "./src/screens/RecipeDetail";
import FamilySettings from "./src/screens/FamilySettings";

// Pin the UI kit's tint to this app's accent color.
colors.tint = "#FF6B35";

const SCREENS = { MealPlan, MealDetail, GroceryList, RecipeIdeas, RecipeDetail, FamilySettings };

function AppInner() {
  const [tab, setTab] = useState("MealPlan");
  const [stack, setStack] = useState([]);

  const navigate = (screen, params) =>
    setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS["MealPlan"];

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      {stack.length > 0 ? (
        <Pressable style={styles.backRow} onPress={goBack}>
          <Icon name="chevron-back" size={26} style={styles.backIcon} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.content}>
        <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} />
      </View>
      {stack.length === 0 ? (
        <SafeAreaView edges={["bottom"]} style={styles.tabBar}>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("MealPlan"); }}>
          <Icon name="calendar" size={24} style={tab === "MealPlan" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "MealPlan" ? styles.tabLabelOn : styles.tabLabel}>This</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("GroceryList"); }}>
          <Icon name="cart" size={24} style={tab === "GroceryList" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "GroceryList" ? styles.tabLabelOn : styles.tabLabel}>Grocery</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("RecipeIdeas"); }}>
          <Icon name="restaurant" size={24} style={tab === "RecipeIdeas" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "RecipeIdeas" ? styles.tabLabelOn : styles.tabLabel}>Recipe</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("FamilySettings"); }}>
          <Icon name="settings" size={24} style={tab === "FamilySettings" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "FamilySettings" ? styles.tabLabelOn : styles.tabLabel}>Family</Text>
        </Pressable>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF3E0" },
  content: { flex: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  backIcon: { color: "#FF6B35" },
  backText: { fontSize: 17, color: "#FF6B35", marginLeft: 2 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.29)",
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    minHeight: 44,
  },
  tabIcon: { color: "#8E8E93" },
  tabIconOn: { color: "#FF6B35" },
  tabLabel: { fontSize: 10, color: "#8E8E93", marginTop: 2, fontWeight: "500" },
  tabLabelOn: { fontSize: 10, color: "#FF6B35", marginTop: 2, fontWeight: "600" },
});
