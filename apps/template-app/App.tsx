import React, { useState } from "react";
import { Text, View } from "react-native";
import {
  AppButton,
  GroupedSection,
  Screen,
  SearchField,
  SegmentedControl,
  SettingsRow,
  Sheet,
  appAlert,
  colors,
  spacing,
} from "./ui";

/**
 * Premium-iOS demo screen built from the kit. Everything is tap-editable:
 *  - hand-authored Text/View below use literal text + inline colors
 *    (tap → edit the text node / override the color),
 *  - kit components (rows, buttons, large title) expose tap-editable PROPS.
 */
export default function App() {
  const [tab, setTab] = useState("All");
  const [wifi, setWifi] = useState(true);
  const [sheet, setSheet] = useState(false);

  return (
    <Screen largeTitle="Settings" background={colors.secondaryBackground}>
      {/* Hand-authored hero card — literal text + inline colors are tap-editable */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Good morning, Jane</Text>
        <Text style={styles.heroSub}>You have 3 updates today</Text>
      </View>

      <View style={{ marginTop: 14 }}>
        <SearchField placeholder="Search" />
      </View>

      <View style={{ marginTop: 12 }}>
        <SegmentedControl
          options={["All", "Favorites", "Recent"]}
          value={tab}
          onChange={(o) => setTab(o)}
        />
      </View>

      <GroupedSection header="Account">
        <SettingsRow
          icon="person-outline"
          iconColor="#34C759"
          label="Apple ID"
          value="Jane Doe"
          onPress={() => setSheet(true)}
        />
        <SettingsRow
          icon="notifications-outline"
          iconColor="#FF3B30"
          label="Notifications"
          value="On"
          onPress={() => {}}
          isLast
        />
      </GroupedSection>

      <GroupedSection
        header="Network"
        footer="Tap a label or value to rename it. Tap the hero text or pick a color to recolor it."
      >
        <SettingsRow
          icon="home-outline"
          iconColor="#007AFF"
          label="Wi-Fi"
          toggle={wifi}
          onToggle={setWifi}
        />
        <SettingsRow
          icon="settings-outline"
          iconColor="#8E8E93"
          label="General"
          onPress={() => {}}
          isLast
        />
      </GroupedSection>

      <View style={styles.actions}>
        <AppButton
          title="Save changes"
          onPress={() => appAlert("Saved", "Your changes are saved.")}
        />
        <AppButton
          title="Sign out"
          variant="destructive"
          onPress={() =>
            appAlert("Sign out?", "You can sign back in anytime.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive" },
            ])
          }
        />
      </View>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Apple ID">
        <SettingsRow label="Name" value="Jane Doe" isLast />
      </Sheet>
    </Screen>
  );
}

const styles = {
  hero: {
    marginHorizontal: spacing.h,
    marginTop: 8,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "#0A84FF",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  heroSub: {
    fontSize: 15,
    color: "#FFFFFFCC",
    marginTop: 4,
  },
  actions: {
    paddingHorizontal: spacing.h,
    paddingTop: 20,
    gap: 12,
  },
};
