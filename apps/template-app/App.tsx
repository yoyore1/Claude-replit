import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors } from "./ui";
import Shop from "./src/screens/Shop";
import ProductDetail from "./src/screens/ProductDetail";
import Cart from "./src/screens/Cart";
import Checkout from "./src/screens/Checkout";
import Orders from "./src/screens/Orders";
import Profile from "./src/screens/Profile";

// Pin the UI kit's tint to this app's accent color.
colors.tint = "#C8431D";

const SCREENS = { Shop, ProductDetail, Cart, Checkout, Orders, Profile };

function AppInner() {
  const [tab, setTab] = useState("Shop");
  const [stack, setStack] = useState([]);

  const navigate = (screen, params) =>
    setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS["Shop"];

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
          <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Shop"); }}>
            <Icon name="home" size={24} style={tab === "Shop" ? styles.tabIconOn : styles.tabIcon} />
            <Text style={tab === "Shop" ? styles.tabLabelOn : styles.tabLabel}>Shop</Text>
          </Pressable>
          <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Cart"); }}>
            <Icon name="cart" size={24} style={tab === "Cart" ? styles.tabIconOn : styles.tabIcon} />
            <Text style={tab === "Cart" ? styles.tabLabelOn : styles.tabLabel}>Cart</Text>
          </Pressable>
          <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Orders"); }}>
            <Icon name="list" size={24} style={tab === "Orders" ? styles.tabIconOn : styles.tabIcon} />
            <Text style={tab === "Orders" ? styles.tabLabelOn : styles.tabLabel}>Orders</Text>
          </Pressable>
          <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Profile"); }}>
            <Icon name="person" size={24} style={tab === "Profile" ? styles.tabIconOn : styles.tabIcon} />
            <Text style={tab === "Profile" ? styles.tabLabelOn : styles.tabLabel}>Profile</Text>
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
  root: { flex: 1, backgroundColor: "#FBF9F5" },
  content: { flex: 1 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  backIcon: { color: "#C8431D" },
  backText: { fontSize: 17, color: "#C8431D", marginLeft: 2 },
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
  tabIconOn: { color: "#C8431D" },
  tabLabel: { fontSize: 10, color: "#8E8E93", marginTop: 2, fontWeight: "500" },
  tabLabelOn: { fontSize: 10, color: "#C8431D", marginTop: 2, fontWeight: "600" },
});
