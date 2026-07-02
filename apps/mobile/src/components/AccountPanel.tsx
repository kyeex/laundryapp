import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { resetDemoOrders } from "@/data/demoStore";
import { resetDemoBusinessSettings } from "@/services/configurationService";
import { registerForPushNotifications } from "@/services/notificationService";
import {
  saveExpoPushToken,
  saveNotificationPreferences,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import {
  defaultNotificationPreferences,
  type NotificationPreferences,
} from "@/types/domain";

import { AppButton } from "./AppButton";

const demoRoles = [
  { label: "Customer", role: "customer" },
  { label: "Owner", role: "owner" },
  { label: "Driver", role: "driver" },
  { label: "Admin", role: "admin" },
] as const;

export function AccountPanel({
  showAccountInfo = true,
  showNotifications = true,
  showSignOut = true,
}: {
  showAccountInfo?: boolean;
  showNotifications?: boolean;
  showSignOut?: boolean;
}) {
  const {
    currentUser,
    isDemoMode,
    isDemoPreviewMode,
    signOut,
    startDemoSession,
    stopDemoPreviewSession,
  } = useAuth();
  const [notificationMessage, setNotificationMessage] = useState("");
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences,
  );

  useEffect(() => {
    setPreferences({
      ...defaultNotificationPreferences,
      ...(currentUser?.notificationPreferences ?? {}),
    });
  }, [currentUser?.id, currentUser?.notificationPreferences]);

  const preferenceOptions = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    if (currentUser.role === "customer") {
      return [
        {
          key: "customerOrderUpdates" as const,
          title: "Order status updates",
          description: "Accepted, picked up, cleaning, delivery, and completed updates.",
        },
        {
          key: "rewardsUpdates" as const,
          title: "Rewards updates",
          description: "Points earned, redeemed, or adjusted.",
        },
      ];
    }

    if (currentUser.role === "owner") {
      return [
        {
          key: "ownerNewRequests" as const,
          title: "New order requests",
          description: "Customer orders that need accept or decline review.",
        },
        {
          key: "ownerPaymentUpdates" as const,
          title: "Payment updates",
          description: "Payment and final-price events that need owner awareness.",
        },
      ];
    }

    if (currentUser.role === "driver") {
      return [
        {
          key: "driverAssignedRoutes" as const,
          title: "Assigned routes",
          description: "Pickup and delivery batches assigned to you.",
        },
      ];
    }

    return [
      {
        key: "ownerNewRequests" as const,
        title: "Operational notifications",
        description: "Admin can keep platform operation alerts available.",
      },
    ];
  }, [currentUser]);

  if (!currentUser) {
    return null;
  }

  async function handleEnableNotifications() {
    if (!currentUser) {
      return;
    }

    setNotificationMessage("");

    try {
      const token = await registerForPushNotifications();
      await saveExpoPushToken(currentUser.id, token);
      setNotificationMessage("Notifications enabled.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to enable notifications right now.";
      setNotificationMessage(message);
    }
  }

  async function updatePreference(
    key: keyof NotificationPreferences,
    value: boolean,
  ) {
    if (!currentUser) {
      return;
    }

    const nextPreferences = {
      ...preferences,
      [key]: value,
    };

    setPreferences(nextPreferences);
    setNotificationMessage("");
    setIsSavingPreferences(true);

    try {
      await saveNotificationPreferences(currentUser.id, nextPreferences);
      setNotificationMessage("Notification preferences saved.");
    } catch (error) {
      setPreferences(preferences);
      setNotificationMessage(
        error instanceof Error
          ? error.message
          : "Unable to save notification preferences.",
      );
    } finally {
      setIsSavingPreferences(false);
    }
  }

  function handleResetDemo() {
    resetDemoOrders();
    resetDemoBusinessSettings();
    setNotificationMessage("Demo data reset.");
  }

  return (
    <View style={styles.panel}>
      {showAccountInfo ? (
        <View>
          <Text style={styles.name}>{currentUser.displayName || "Signed in"}</Text>
          <Text style={styles.meta}>
            {currentUser.email} · {currentUser.role}
          </Text>
        </View>
      ) : null}
      {notificationMessage ? (
        <Text style={styles.message}>{notificationMessage}</Text>
      ) : null}
      {isDemoPreviewMode ? (
        <View style={styles.previewNotice}>
          <Text style={styles.previewTitle}>Role preview</Text>
          <Text style={styles.previewText}>
            You are viewing local demo data through this role. Real staging data is
            not changed while preview mode is active.
          </Text>
          <AppButton
            label="Return to real admin"
            onPress={stopDemoPreviewSession}
            variant="secondary"
          />
        </View>
      ) : null}
      {isDemoMode ? (
        <View style={styles.demoControls}>
          <Text style={styles.sectionLabel}>Demo role</Text>
          <View style={styles.roleGrid}>
            {demoRoles.map((item) => (
              <View key={item.role} style={styles.roleButton}>
                <AppButton
                  disabled={currentUser.role === item.role}
                  label={item.label}
                  onPress={() => startDemoSession(item.role)}
                  variant="secondary"
                />
              </View>
            ))}
          </View>
          <AppButton
            label="Reset demo data"
            onPress={handleResetDemo}
            variant="secondary"
          />
        </View>
      ) : showNotifications ? (
        <View style={styles.notificationSection}>
          <View style={styles.notificationHeader}>
            <View style={styles.notificationHeaderText}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <Text style={styles.notificationCopy}>
                Choose what this account should hear about. Real push delivery
                requires the native mobile app.
              </Text>
            </View>
            <View style={styles.notificationEnableButton}>
              <AppButton
                label="Enable"
                onPress={handleEnableNotifications}
                variant="secondary"
              />
            </View>
          </View>
          <View style={styles.preferenceList}>
            {preferenceOptions.map((option) => (
              <View
                key={option.key}
                style={styles.preferenceRow}
              >
                <View style={styles.preferenceText}>
                  <Text style={styles.preferenceTitle}>{option.title}</Text>
                  <Text style={styles.preferenceDescription}>
                    {option.description}
                  </Text>
                </View>
                <Switch
                  disabled={isSavingPreferences}
                  onValueChange={(value) => updatePreference(option.key, value)}
                  thumbColor={preferences[option.key] ? colors.primary : "#FFFFFF"}
                  trackColor={{ false: "#CBD5E1", true: "#99F6E4" }}
                  value={preferences[option.key]}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {showSignOut ? <AppButton label="Sign out" onPress={signOut} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    padding: Platform.select({
      default: spacing.md,
      web: spacing.md,
    }),
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.05,
      web: 0,
    }),
    shadowRadius: 6,
    elevation: Platform.select({
      default: 1,
      web: 0,
    }),
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 24,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  message: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  previewNotice: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  previewText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  demoControls: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  notificationSection: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  notificationHeader: {
    alignItems: Platform.select({
      default: "stretch",
      web: "center",
    }),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  notificationEnableButton: {
    alignSelf: "stretch",
    minWidth: Platform.select({
      default: "100%",
      web: 120,
    }),
  },
  notificationHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: Platform.select({
      default: "100%",
      web: 220,
    }),
  },
  notificationCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  preferenceList: {
    gap: spacing.sm,
  },
  preferenceRow: {
    alignItems: Platform.select({
      default: "flex-start",
      web: "center",
    }),
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 72,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  preferenceText: {
    flex: 1,
    gap: spacing.xs,
  },
  preferenceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  preferenceDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleButton: {
    minWidth: 112,
  },
});
