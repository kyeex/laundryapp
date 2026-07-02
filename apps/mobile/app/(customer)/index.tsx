import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import {
  ActionGrid,
  ActionLink,
  ActionPanel,
  MetricCard,
  MetricGrid,
  PageHeader,
} from "@/components/OperatingDashboard";
import { RoleHomeVisual } from "@/components/RoleHomeVisual";
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
  const customerName =
    currentUser?.displayName || currentUser?.email?.split("@")[0] || "user";

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.welcomeCard}>
          <AccountPanel showNotifications={false} showSignOut={false} />
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeEyebrow}>Customer home</Text>
            <Text style={styles.welcomeTitle}>Welcome, {customerName}</Text>
            <Text style={styles.welcomeText}>
              Start an order, check your laundry status, or manage your profile.
            </Text>
          </View>
        </View>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <RoleHomeVisual role="customer" />

        <ActionPanel title="Quick actions">
          <ActionLink href="/(customer)/new-order" label="Start new order" primary />
          <ActionGrid>
            <ActionLink href="/(customer)/my-orders" label="View order history" />
            <ActionLink href="/(customer)/profile-summary" label="Profile summary" />
            <ActionLink href="/(customer)/payment-method" label="Payment method" />
            <ActionLink href="/(customer)/recurring-orders" label="Recurring orders" />
            {rewardsEnabled ? (
              <ActionLink href="/(customer)/rewards" label="Rewards" />
            ) : null}
          </ActionGrid>
        </ActionPanel>

        <MetricGrid compact>
          <MetricCard
            compact
            label="Upcoming pickup"
            note={
              upcomingPickup
                ? `${formatDisplayDate(upcomingPickup.scheduledPickupDate)} · ${upcomingPickup.scheduledPickupWindow}`
                : "Start an order to schedule pickup."
            }
            tone={upcomingPickup ? "success" : "neutral"}
            value={upcomingPickup ? formatOrderStatus(upcomingPickup.status) : "None"}
          />
          <MetricCard
            compact
            label="Active orders"
            note="Orders still moving through pickup, service, payment, or delivery."
            tone={activeOrders.length > 0 ? "info" : "neutral"}
            value={`${activeOrders.length}`}
          />
          <MetricCard
            compact
            label="Profile"
            note={profileComplete ? "Ready for fast checkout." : "Add phone and default address."}
            tone={profileComplete ? "success" : "attention"}
            value={profileComplete ? "Complete" : "Needs attention"}
          />
          {rewardsEnabled ? (
            <MetricCard
              compact
              label="Rewards"
              note="Earn points and preview future laundry credits."
              tone="accent"
              value={`${rewardsPoints}`}
            />
          ) : null}
        </MetricGrid>
        <DemoWalkthrough
          title="Customer demo path"
          steps={[
            "Confirm profile and payment method.",
            "Place a wash and fold order with add-ons.",
            "Review the estimate, authorize demo payment, and track status.",
          ]}
        />
        <AccountPanel showAccountInfo={false} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    paddingTop: Platform.select({
      default: spacing.sm,
      web: spacing.xl,
    }),
  },
  welcomeCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  welcomeCopy: {
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  welcomeEyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: Platform.select({
      default: 28,
      web: 34,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 34,
      web: 40,
    }),
    textAlign: "center",
  },
  welcomeText: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 15,
      web: 17,
    }),
    fontWeight: "800",
    lineHeight: Platform.select({
      default: 22,
      web: 25,
    }),
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
