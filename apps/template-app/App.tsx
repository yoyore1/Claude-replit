import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
import {
  Screen,
  GroupedSection,
  SettingsRow,
  SegmentedControl,
  SearchField,
  AppButton,
  Sheet,
  Icon,
  appAlert,
  actionMenu,
  share,
  colors,
  type,
  spacing,
  radius,
} from "./ui";

type Tab = "Home" | "Log" | "History" | "Settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        {tab === "Home" && <HomeScreen />}
        {tab === "Log" && <LogScreen />}
        {tab === "History" && <HistoryScreen />}
        {tab === "Settings" && <SettingsScreen />}
      </View>
      <TabBar current={tab} onChange={setTab} />
    </View>
  );
}

function HomeScreen() {
  return (
    <Screen largeTitle="Today">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.heroHeader}>
            <Text style={styles.heroLabel}>Daily Progress</Text>
            <Text style={styles.heroDate}>Monday</Text>
          </View>
          <Text style={styles.heroValue}>2,450</Text>
          <Text style={styles.heroSub}>of 5,000 steps</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>320</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>45</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
          </View>
        </View>

        <View style={styles.weekCard}>
          <Text style={styles.weekTitle}>This Week</Text>
          <View style={styles.weekStrip}>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Mon</Text>
              <View style={[styles.dayDot, styles.dayDotActive]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Tue</Text>
              <View style={[styles.dayDot, styles.dayDotActive]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Wed</Text>
              <View style={[styles.dayDot, styles.dayDotInactive]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Thu</Text>
              <View style={[styles.dayDot, styles.dayDotActive]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Fri</Text>
              <View style={[styles.dayDot, styles.dayDotInactive]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Sat</Text>
              <View style={[styles.dayDot, styles.dayDotToday]} />
            </View>
            <View style={styles.dayItem}>
              <Text style={styles.dayLabel}>Sun</Text>
              <View style={[styles.dayDot, styles.dayDotInactive]} />
            </View>
          </View>
        </View>

        <GroupedSection header="Quick Start">
          <SettingsRow
            label="Start Workout"
            icon="play.circle.fill"
            onPress={() =>
              appAlert("Starting Workout", "Get ready to begin your session.")
            }
          />
          <SettingsRow
            label="Log Exercise"
            icon="plus.circle.fill"
            onPress={() =>
              appAlert("Log Exercise", "Add a new exercise entry.")
            }
          />
          <SettingsRow
            label="View History"
            icon="clock.fill"
            onPress={() => appAlert("History", "View your past workouts.")}
          />
        </GroupedSection>

        <GroupedSection header="Recent Activity">
          <SettingsRow label="Morning Strength" value="45 min" />
          <SettingsRow label="Evening Yoga" value="30 min" />
          <SettingsRow label="Cardio Run" value="25 min" />
        </GroupedSection>

        <GroupedSection
          header="Goals"
          footer="Stay consistent to reach your weekly target"
        >
          <SettingsRow label="Weekly Workouts" value="3 of 5" />
          <SettingsRow label="Active Minutes" value="180 of 210" />
        </GroupedSection>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Daily Tip</Text>
          <Text style={styles.tipText}>
            Stay hydrated and take short walks throughout the day.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function LogScreen() {
  const [type, setType] = useState("Strength");
  const [intensity, setIntensity] = useState("Medium");
  const [showSheet, setShowSheet] = useState(false);

  return (
    <Screen largeTitle="Log Workout">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GroupedSection header="Exercise Type">
          <View style={styles.segmentedWrap}>
            <SegmentedControl
              options={["Strength", "Cardio", "Yoga", "Other"]}
              value={type}
              onChange={setType}
            />
          </View>
        </GroupedSection>

        <GroupedSection header="Duration">
          <SettingsRow
            label="Minutes"
            value="45"
            onPress={() =>
              actionMenu("Duration", [
                "15 min",
                "30 min",
                "45 min",
                "60 min",
                "90 min",
              ])
            }
          />
          <SettingsRow
            label="Calories"
            value="320"
            onPress={() =>
              actionMenu("Calories", [
                "150",
                "200",
                "250",
                "320",
                "400",
                "500",
              ])
            }
          />
        </GroupedSection>

        <GroupedSection header="Intensity">
          <View style={styles.segmentedWrap}>
            <SegmentedControl
              options={["Low", "Medium", "High"]}
              value={intensity}
              onChange={setIntensity}
            />
          </View>
        </GroupedSection>

        <GroupedSection header="Details">
          <SettingsRow label="Date" value="Today" />
          <SettingsRow label="Time" value="7:30 AM" />
        </GroupedSection>

        <GroupedSection header="Notes">
          <SettingsRow
            label="Add notes"
            value="Optional"
            onPress={() =>
              appAlert("Notes", "Add details about your workout.")
            }
          />
        </GroupedSection>

        <View style={styles.buttonWrap}>
          <AppButton title="Save Workout" onPress={() => setShowSheet(true)} />
        </View>
      </ScrollView>

      <Sheet visible={showSheet} onClose={() => setShowSheet(false)}>
        <View style={styles.sheetContent}>
          <Text style={styles.sheetTitle}>Workout Saved</Text>
          <Text style={styles.sheetMessage}>
            Great job! Your workout has been logged successfully.
          </Text>
          <View style={styles.sheetButton}>
            <AppButton title="Done" onPress={() => setShowSheet(false)} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

function HistoryScreen() {
  return (
    <Screen largeTitle="History">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrap}>
          <SearchField placeholder="Search workouts" />
        </View>

        <GroupedSection header="This Week">
          <SettingsRow label="Morning Strength" value="Mon · 45 min" />
          <SettingsRow label="Evening Yoga" value="Wed · 30 min" />
          <SettingsRow label="Cardio Run" value="Fri · 25 min" />
        </GroupedSection>

        <GroupedSection header="Last Week">
          <SettingsRow label="Full Body" value="Mon · 60 min" />
          <SettingsRow label="Stretching" value="Thu · 20 min" />
          <SettingsRow label="Evening Walk" value="Sat · 40 min" />
        </GroupedSection>

        <GroupedSection header="Stats Summary">
          <SettingsRow label="Total Workouts" value="12" />
          <SettingsRow label="Total Time" value="6h 45m" />
          <SettingsRow label="Avg per Week" value="4.2" />
          <SettingsRow label="Current Streak" value="5 days" />
        </GroupedSection>
      </ScrollView>
    </Screen>
  );
}

function SettingsScreen() {
  return (
    <Screen largeTitle="Settings">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GroupedSection header="Goals">
          <SettingsRow
            label="Daily Steps"
            value="5,000"
            onPress={() =>
              actionMenu("Daily Steps", ["3,000", "5,000", "8,000", "10,000"])
            }
          />
          <SettingsRow
            label="Weekly Workouts"
            value="5"
            onPress={() =>
              actionMenu("Weekly Workouts", ["3", "4", "5", "7"])
            }
          />
          <SettingsRow
            label="Active Minutes"
            value="30"
            onPress={() =>
              actionMenu("Active Minutes", ["15", "30", "45", "60"])
            }
          />
        </GroupedSection>

        <GroupedSection header="Reminders">
          <SettingsRow
            label="Workout Reminders"
            value="On"
            onPress={() => actionMenu("Reminders", ["On", "Off"])}
          />
          <SettingsRow
            label="Daily Reminder"
            value="7:00 AM"
            onPress={() =>
              appAlert("Reminder Time", "Set your daily reminder time.")
            }
          />
          <SettingsRow
            label="Weekly Summary"
            value="Sunday"
            onPress={() => actionMenu("Summary Day", ["Monday", "Sunday"])}
          />
        </GroupedSection>

        <GroupedSection header="Preferences">
          <SettingsRow
            label="Units"
            value="Metric"
            onPress={() => actionMenu("Units", ["Metric", "Imperial"])}
          />
          <SettingsRow
            label="Theme"
            value="Calm Blue"
            onPress={() =>
              actionMenu("Theme", ["Calm Blue", "Light", "Dark"])
            }
          />
          <SettingsRow
            label="Sound"
            value="Gentle"
            onPress={() =>
              actionMenu("Sound", ["Off", "Gentle", "Energetic"])
            }
          />
        </GroupedSection>

        <GroupedSection header="About">
          <SettingsRow label="Version" value="1.0.0" />
          <SettingsRow
            label="Share App"
            onPress={() =>
              share("Check out BlueFit Tracker!", "https://bluefit.app")
            }
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() =>
              appAlert("Privacy Policy", "View our privacy policy.")
            }
          />
        </GroupedSection>
      </ScrollView>
    </Screen>
  );
}

function TabBar({
  current,
  onChange,
  style,
}: {
  current: Tab;
  onChange: (tab: Tab) => void;
  style?: any;
}) {
  return (
    <View style={[styles.tabBar, style]}>
      <Pressable
        style={styles.tabItem}
        onPress={() => onChange("Home")}
      >
        <Icon name={current === "Home" ? "house.fill" : "house"} />
        <Text
          style={[
            styles.tabLabel,
            current === "Home" && styles.tabLabelActive,
          ]}
        >
          Home
        </Text>
      </Pressable>
      <Pressable
        style={styles.tabItem}
        onPress={() => onChange("Log")}
      >
        <Icon name={current === "Log" ? "plus.circle.fill" : "plus.circle"} />
        <Text
          style={[
            styles.tabLabel,
            current === "Log" && styles.tabLabelActive,
          ]}
        >
          Log
        </Text>
      </Pressable>
      <Pressable
        style={styles.tabItem}
        onPress={() => onChange("History")}
      >
        <Icon name={current === "History" ? "clock.fill" : "clock"} />
        <Text
          style={[
            styles.tabLabel,
            current === "History" && styles.tabLabelActive,
          ]}
        >
          History
        </Text>
      </Pressable>
      <Pressable
        style={styles.tabItem}
        onPress={() => onChange("Settings")}
      >
        <Icon
          name={current === "Settings" ? "gearshape.fill" : "gearshape"}
        />
        <Text
          style={[
            styles.tabLabel,
            current === "Settings" && styles.tabLabelActive,
          ]}
        >
          Settings
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E6F2FF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    overflow: "hidden",
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  heroAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#4A90E2",
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A90E2",
    letterSpacing: 0.5,
  },
  heroDate: {
    fontSize: 13,
    color: "#6B8CAE",
  },
  heroValue: {
    fontSize: 48,
    fontWeight: "700",
    color: "#1A3A5C",
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 15,
    color: "#6B8CAE",
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#D0E4F7",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    width: "60%",
    height: "100%",
    backgroundColor: "#4A90E2",
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A3A5C",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B8CAE",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#D0E4F7",
  },
  weekCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A3A5C",
    marginBottom: 12,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
  },
  dayLabel: {
    fontSize: 11,
    color: "#6B8CAE",
    marginBottom: 6,
    fontWeight: "500",
  },
  dayDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dayDotActive: {
    backgroundColor: "#4A90E2",
  },
  dayDotInactive: {
    backgroundColor: "#D0E4F7",
  },
  dayDotToday: {
    backgroundColor: "#4A90E2",
    borderWidth: 3,
    borderColor: "#E6F2FF",
  },
  tipCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A90E2",
    marginBottom: 6,
  },
  tipText: {
    fontSize: 15,
    color: "#1A3A5C",
    lineHeight: 22,
  },
  segmentedWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetContent: {
    padding: 24,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A3A5C",
    marginBottom: 8,
  },
  sheetMessage: {
    fontSize: 15,
    color: "#6B8CAE",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  sheetButton: {
    width: "100%",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#D0E4F7",
    paddingBottom: 24,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 10,
    color: "#6B8CAE",
    marginTop: 4,
    fontWeight: "500",
  },
  tabLabelActive: {
    color: "#4A90E2",
    fontWeight: "600",
  },
});
