import React, { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Icon, colors, setAppId, GlassPanel, StoreProvider } from "./ui";
import Home from "./src/screens/Home";
import BookWalk from "./src/screens/BookWalk";
import Messages from "./src/screens/Messages";
import Profile from "./src/screens/Profile";
import WalkDetail from "./src/screens/WalkDetail";
import ChatDetail from "./src/screens/ChatDetail";
import Settings from "./src/screens/Settings";
import PrivacyPolicy from "./src/screens/PrivacyPolicy";
import TermsOfService from "./src/screens/TermsOfService";
import Support from "./src/screens/Support";

// Pin the UI kit's tint to this app's accent color.
colors.tint = "#FF6B35";
// Scope this app's cloud data (RAG) to its own id.
setAppId("p_ef405058fc5d1ffe7e");

const SEED = {"Dog":[{"id":"dog_1","name":"Biscuit","breed":"Golden Retriever","age":3,"notes":"Loves squirrels, hates the vacuum.","photoUrl":"biscuit.jpg"},{"id":"dog_2","name":"Mochi","breed":"Shiba Inu","age":2,"notes":"Shy with strangers, treat-motivated.","photoUrl":"mochi.jpg"}],"Walker":[{"id":"walker_1","name":"Alex P.","rating":4.9,"bio":"Dog lover with 5 years of walking experience. Patient with pups of all sizes.","neighborhood":"Riverside","walksCompleted":312},{"id":"walker_2","name":"Sam K.","rating":4.8,"bio":"Vet student. Extra careful with senior dogs and puppies.","neighborhood":"Downtown","walksCompleted":184},{"id":"walker_3","name":"Riley M.","rating":5,"bio":"Runner-style walks for high-energy breeds. Trail enthusiast.","neighborhood":"East Park","walksCompleted":97}],"Walk":[{"id":"walk_1","name":"Biscuit","walkerName":"Alex P.","date":"2025-01-20","time":"10:00 AM","duration":30,"status":"Upcoming","notes":"Use the harness, not the collar."},{"id":"walk_2","name":"Mochi","walkerName":"Sam K.","date":"2025-01-21","time":"4:30 PM","duration":45,"status":"Upcoming","notes":"Bring treats — she's shy today."},{"id":"walk_3","name":"Biscuit","walkerName":"Alex P.","date":"2025-01-18","time":"9:00 AM","duration":30,"status":"Completed","notes":"Great walk! Sent photos."}],"Message":[{"id":"message_1","name":"Alex P.","text":"Hi! I'll be there at 10 sharp. Biscuit will love today's route 🌳","fromMe":false,"timestamp":"9:42 AM"},{"id":"message_2","name":"Alex P.","text":"Perfect, thank you! Please send a pic mid-walk?","fromMe":true,"timestamp":"9:45 AM"},{"id":"message_3","name":"Alex P.","text":"On it! He just sniffed a very important leaf 🐕🍂","fromMe":false,"timestamp":"10:14 AM"}]};

const SCREENS = { Home, BookWalk, Messages, Profile, WalkDetail, ChatDetail, Settings, PrivacyPolicy, TermsOfService, Support };

function AppInner() {
  const [tab, setTab] = useState("Home");
  const [stack, setStack] = useState([]);

  const navigate = (screen, params) =>
    setStack((s) => [...s, { screen, params }]);
  const goBack = () => setStack((s) => s.slice(0, -1));

  const top = stack.length ? stack[stack.length - 1] : null;
  const activeId = top ? top.screen : tab;
  const Active = SCREENS[activeId] || SCREENS["Home"];

  // iOS-style horizontal slide whenever the visible screen changes (push/pop/tab).
  const slideX = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    slideX.setValue(Dimensions.get("window").width);
    Animated.timing(slideX, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeId]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.flex} edges={["top"]}>
        {stack.length > 0 ? (
          <GlassPanel tint="light" style={styles.navBar}>
            <Pressable style={styles.backRow} onPress={goBack}>
              <Icon name="chevron-back" size={26} style={styles.backIcon} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </GlassPanel>
        ) : null}
        <Animated.View style={[styles.content, { transform: [{ translateX: slideX }] }]}>
          <Active navigate={navigate} goBack={goBack} params={top ? top.params : undefined} />
        </Animated.View>
      </SafeAreaView>
      {stack.length === 0 ? (
        <GlassPanel tint="light" style={styles.tabBar}>
          <SafeAreaView edges={["bottom"]} style={styles.tabBarInner}>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Home"); }}>
          <Icon name="home" size={24} style={tab === "Home" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "Home" ? styles.tabLabelOn : styles.tabLabel}>Home</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("BookWalk"); }}>
          <Icon name="add" size={24} style={tab === "BookWalk" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "BookWalk" ? styles.tabLabelOn : styles.tabLabel}>Book</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Messages"); }}>
          <Icon name="chatbubble" size={24} style={tab === "Messages" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "Messages" ? styles.tabLabelOn : styles.tabLabel}>Messages</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Profile"); }}>
          <Icon name="person" size={24} style={tab === "Profile" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "Profile" ? styles.tabLabelOn : styles.tabLabel}>Profile</Text>
        </Pressable>
        <Pressable style={styles.tabItem} onPress={() => { setStack([]); setTab("Settings"); }}>
          <Icon name="settings" size={24} style={tab === "Settings" ? styles.tabIconOn : styles.tabIcon} />
          <Text style={tab === "Settings" ? styles.tabLabelOn : styles.tabLabel}>Settings</Text>
        </Pressable>
          </SafeAreaView>
        </GlassPanel>
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
    <StoreProvider seed={SEED}>
      <AppInner />
    </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF3E0" },
  flex: { flex: 1 },
  content: { flex: 1, overflow: "hidden" },
  navBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(60,60,67,0.29)",
  },
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.29)",
  },
  tabBarInner: {
    flexDirection: "row",
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
