import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrders } from "@/services/orderService";
import {
  getCustomerLaundryPreferences,
  getCustomerProfileSummary,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatOrderStatus, isStoppedOrderStatus } from "@/workflows/orderWorkflow";

function isActiveOrder(order: Order) {
  return !isStoppedOrderStatus(order.status) && !["completed", "delivered"].includes(order.status);
}

function DashboardCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View style={styles.dashboardCard}>
      <Text style={styles.dashboardLabel}>{label}</Text>
      <Text style={styles.dashboardValue}>{value}</Text>
      <Text style={styles.dashboardNote}>{note}</Text>
    </View>
  );
}

export default function CustomerHomeScreen() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profileComplete, setProfileComplete] = useState(false);
  const [preferencesComplete, setPreferencesComplete] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [customerOrders, profile, preferences] = await Promise.all([
        getCustomerOrders(currentUser.id),
        getCustomerProfileSummary(currentUser.id),
        getCustomerLaundryPreferences(currentUser.id),
      ]);
      const address = profile.defaultAddress;

      setOrders(customerOrders);
      setProfileComplete(
        Boolean(
          profile.displayName &&
            profile.email &&
            profile.phone &&
            address.street1 &&
            address.city &&
            address.state &&
            address.postalCode,
        ),
      );
      setPreferencesComplete(
        Object.values(preferences).some((value) => value.trim().length > 0),
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer dashboard.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders]);
  const upcomingPickup = activeOrders.find((order) => order.scheduledPickupDate);

  return (
    <Screen>
      <View style={styles.content}>
        <AccountPanel />
        <Text style={styles.title}>Customer home</Text>
        <Text style={styles.body}>
          Request wash and fold, dry cleaning, or both with configurable
          add-ons.
        </Text>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.dashboardGrid}>
          <DashboardCard
            label="Upcoming pickup"
            note={
              upcomingPickup
                ? `${upcomingPickup.scheduledPickupDate} · ${upcomingPickup.scheduledPickupWindow}`
                : "Start an order to schedule pickup."
            }
            value={upcomingPickup ? formatOrderStatus(upcomingPickup.status) : "None"}
          />
          <DashboardCard
            label="Active orders"
            note="Orders still moving through pickup, service, payment, or delivery."
            value={`${activeOrders.length}`}
          />
          <DashboardCard
            label="Profile"
            note={profileComplete ? "Ready for fast checkout." : "Add phone and default address."}
            value={profileComplete ? "Complete" : "Needs attention"}
          />
          <DashboardCard
            label="Preferences"
            note={
              preferencesComplete
                ? "Laundry notes can populate new orders."
                : "Save detergent, folding, and care preferences."
            }
            value={preferencesComplete ? "Saved" : "Not set"}
          />
        </View>
        <DemoWalkthrough
          title="Customer demo path"
          steps={[
            "Confirm profile and laundry preferences.",
            "Place a wash and fold order with add-ons.",
            "Review the estimate, authorize demo payment, and track status.",
          ]}
        />
        <Link href="/(customer)/new-order" style={styles.action}>
          Start new order
        </Link>
        <Link href="/(customer)/profile-summary" style={styles.secondary}>
          Customer Profile Summary
        </Link>
        <Link href="/(customer)/preferences" style={styles.secondary}>
          Customer Preferences
        </Link>
        <Link href="/(customer)/orders" style={styles.secondary}>
          View orders
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  action: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "800",
    padding: spacing.md,
    textAlign: "center",
  },
  secondary: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dashboardCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 180,
    padding: spacing.md,
  },
  dashboardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dashboardValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  dashboardNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
