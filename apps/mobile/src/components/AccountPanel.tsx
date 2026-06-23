import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { resetDemoOrders } from "@/data/demoStore";
import { resetDemoBusinessSettings } from "@/services/configurationService";
import { registerForPushNotifications } from "@/services/notificationService";
import { saveExpoPushToken } from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

import { AppButton } from "./AppButton";

const demoRoles = [
  { label: "Customer", role: "customer" },
  { label: "Owner", role: "owner" },
  { label: "Driver", role: "driver" },
  { label: "Admin", role: "admin" },
] as const;

export function AccountPanel() {
  const {
    currentUser,
    isDemoMode,
    isDemoPreviewMode,
    signOut,
    startDemoSession,
    stopDemoPreviewSession,
  } = useAuth();
  const [notificationMessage, setNotificationMessage] = useState("");

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

  function handleResetDemo() {
    resetDemoOrders();
    resetDemoBusinessSettings();
    setNotificationMessage("Demo data reset.");
  }

  return (
    <View style={styles.panel}>
      <View>
        <Text style={styles.name}>{currentUser.displayName || "Signed in"}</Text>
        <Text style={styles.meta}>
          {currentUser.email} · {currentUser.role}
        </Text>
      </View>
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
      ) : (
        <AppButton
          label="Enable notifications"
          onPress={handleEnableNotifications}
          variant="secondary"
        />
      )}
      <AppButton label="Sign out" onPress={signOut} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
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
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleButton: {
    minWidth: 112,
  },
});
