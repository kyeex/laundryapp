import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrders } from "@/services/orderService";
import {
  getCustomerLoyaltyRewards,
  getLoyaltyRewardSettings,
} from "@/services/loyaltyRewardsService";
import { getCustomerProfileSummary } from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
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
  const [rewardsEnabled, setRewardsEnabled] = useState(false);
  const [rewardsPoints, setRewardsPoints] = useState(0);
  const [profileComplete, setProfileComplete] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [customerOrders, profile, rewardSettings] = await Promise.all([
        getCustomerOrders(currentUser.id),
        getCustomerProfileSummary(currentUser.id),
        getLoyaltyRewardSettings(),
      ]);
      const address = profile.defaultAddress;

      setOrders(customerOrders);
      setRewardsEnabled(rewardSettings.enabled);
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

      if (rewardSettings.enabled) {
        try {
          const rewards = await getCustomerLoyaltyRewards(
            currentUser.id,
            profile.displayName ||
              currentUser.displayName ||
              currentUser.email ||
              "Customer",
          );
          setRewardsPoints(rewards.pointsBalance);
        } catch {
          setRewardsPoints(0);
        }
      } else {
        setRewardsPoints(0);
      }
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
                ? `${formatDisplayDate(upcomingPickup.scheduledPickupDate)} · ${upcomingPickup.scheduledPickupWindow}`
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
          {rewardsEnabled ? (
            <DashboardCard
              label="Rewards"
              note="Earn points and preview future laundry credits."
              value={`${rewardsPoints}`}
            />
          ) : null}
        </View>
        <DemoWalkthrough
          title="Customer demo path"
          steps={[
            "Confirm profile and payment method.",
            "Place a wash and fold order with add-ons.",
            "Review the estimate, authorize demo payment, and track status.",
          ]}
        />
        <View style={styles.actionPanel}>
          <Text style={styles.actionTitle}>Quick actions</Text>
          <Link href="/(customer)/new-order" style={styles.primaryAction}>
            Start new order
          </Link>
          <View style={styles.actionGrid}>
            <Link href="/(customer)/my-orders" style={styles.secondaryAction}>
              View order history
            </Link>
            <Link href="/(customer)/profile-summary" style={styles.secondaryAction}>
              Profile summary
            </Link>
            <Link href="/(customer)/payment-method" style={styles.secondaryAction}>
              Payment method
            </Link>
            <Link href="/(customer)/recurring-orders" style={styles.secondaryAction}>
              Recurring orders
            </Link>
            {rewardsEnabled ? (
              <Link href="/(customer)/rewards" style={styles.secondaryAction}>
                Rewards
              </Link>
            ) : null}
          </View>
        </View>
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
  actionPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "800",
    padding: spacing.md,
    textAlign: "center",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  secondaryAction: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flexGrow: 1,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 160,
    padding: spacing.md,
    textAlign: "center",
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
