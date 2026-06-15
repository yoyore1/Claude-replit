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

export default function App() {
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const openEditSheet = () => setEditSheetOpen(true);
  const closeEditSheet = () => setEditSheetOpen(false);

  const handleSave = () => {
    closeEditSheet();
    appAlert("Profile Updated", "Your profile changes have been saved.");
  };

  const handleShare = async () => {
    try {
      await share("Check out Alex Morgan's profile!");
    } catch (e) {}
  };

  return (
    <Screen largeTitle="Profile">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, {
          color: "#cb2a2a",
          backgroundColor: "#2c52c3"
        }]}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
            }}
            style={styles.avatar}
          />
          <Text style={[styles.name, {
            color: "#af187f"
          }]}>Alex Morg</Text>
          <Text style={styles.handle}>@alexmorgan</Text>
          <Text style={styles.bio}>
            Designer, traveler, coffee enthusiast. Building beautiful things one pixel at a time.
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>248</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1.2K</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>342</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <View style={styles.editButtonWrapper}>
            <AppButton
              title="Edit My Prof"
              onPress={openEditSheet}
              style={{
                backgroundColor: "#d02525"
              }}>Edit Profi</AppButton>
          </View>
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareButtonText}>Sha</Text>
          </Pressable>
        </View>

        <GroupedSection
          header="Details"
          headerStyle={{
            color: "#34C759"
          }}>
          <SettingsRow label="Email" value="alex@example.com" />
          <SettingsRow label="Location" value="San Francisco, CA" />
          <SettingsRow label="Joined" value="March 2021" />
          <SettingsRow label="Website" value="alexmorgan.design" />
        </GroupedSection>

        <GroupedSection
          header="Account"
          footer="Manage your account settings and preferences."
        >
          <SettingsRow label="Privacy" />
          <SettingsRow label="Notifications" />
          <SettingsRow label="Help & Support" />
          <SettingsRow label="Sign Out" destructive />
        </GroupedSection>
      </ScrollView>
      <Sheet visible={editSheetOpen} onClose={closeEditSheet} title="Edit Profile">
        <View style={styles.sheetContent}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
            }}
            style={styles.sheetAvatar}
          />
          <Text style={styles.sheetFieldLabel}>Name</Text>
          <View style={styles.sheetFieldValue}>
            <Text style={styles.sheetFieldText}>Alex Morgan</Text>
          </View>
          <Text style={styles.sheetFieldLabel}>Bio</Text>
          <View style={styles.sheetFieldValue}>
            <Text style={styles.sheetFieldText}>
              Designer, traveler, coffee enthusiast.
            </Text>
          </View>
          <View style={styles.sheetActions}>
            <AppButton title="Save Changes" onPress={handleSave} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#E5E5EA",
    marginBottom: 16,
  },
  name: {
    ...type.title2,
    color: colors.label,
    marginBottom: 2,
  },
  handle: {
    ...type.subheadline,
    color: colors.secondaryLabel,
    marginBottom: 12,
  },
  bio: {
    ...type.body,
    color: colors.label,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    ...type.title3,
    fontWeight: "600",
    color: colors.label,
  },
  statLabel: {
    ...type.footnote,
    color: colors.secondaryLabel,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#C6C6C8",
    marginVertical: 4,
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  editButtonWrapper: {
    flex: 2,
    marginRight: 8,
  },
  shareButton: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  shareButtonText: {
    ...type.body,
    fontWeight: "600",
    color: "#007AFF",
  },
  sheetContent: {
    padding: 20,
  },
  sheetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignSelf: "center",
    marginBottom: 20,
    backgroundColor: "#E5E5EA",
  },
  sheetFieldLabel: {
    ...type.footnote,
    color: colors.secondaryLabel,
    marginBottom: 6,
    marginTop: 12,
    fontWeight: "500",
  },
  sheetFieldValue: {
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sheetFieldText: {
    ...type.body,
    color: colors.label,
  },
  sheetActions: {
    marginTop: 24,
  },
});
