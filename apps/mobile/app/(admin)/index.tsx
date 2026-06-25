import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { getEligibleOrdersForBatch } from "@/services/batchService";
import { getAdminOrders } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";

type DashboardTone = "requests" | "payment" | "pickup" | "delivery";

function DashboardCard({
  href,
  highlighted = false,
  label,
  tone,
  value,
}: {
  href: string;
  highlighted?: boolean;
  label: string;
  tone: DashboardTone;
  value: number;
}) {
  const cardToneStyle = {
    requests: styles.dashboardCardRequests,
    payment: styles.dashboardCardPayment,
    pickup: styles.dashboardCardPickup,
    delivery: styles.dashboardCardDelivery,
  }[tone];
  const valueToneStyle = {
    requests: styles.dashboardValueRequests,
    payment: styles.dashboardValuePayment,
    pickup: styles.dashboardValuePickup,
    delivery: styles.dashboardValueDelivery,
  }[tone];

  return (
    <Link
      href={href}
      style={[
        styles.dashboardCard,
        cardToneStyle,
        highlighted && styles.dashboardCardHighlighted,
      ]}
    >
      <View style={styles.dashboardCardContent}>
        <View style={styles.dashboardTextGroup}>
          <Text
            style={[
              styles.dashboardLabel,
              highlighted && styles.dashboardLabelHighlighted,
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.dashboardStatus,
              highlighted && styles.dashboardStatusHighlighted,
            ]}
          >
            {highlighted ? "Review" : value > 0 ? "Open" : "Clear"}
          </Text>
        </View>
        <Text
          style={[
            styles.dashboardValue,
            valueToneStyle,
            highlighted && styles.dashboardValueHighlighted,
          ]}
        >
          {value}
        </Text>
      </View>
    </Link>
  );
}

export default function AdminHomeScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const adminOrders = await getAdminOrders();
      setOrders(adminOrders);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load owner dashboard.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const newRequests = useMemo(
    () => orders.filter((order) => order.status === "requested").length,
    [orders],
  );
  const pricingNeeded = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === "in_progress" ||
          (order.finalPrice !== null && order.paymentStatus !== "paid"),
      ).length,
    [orders],
  );
  const pickupReady = useMemo(
    () => getEligibleOrdersForBatch(orders, "pickup").length,
    [orders],
  );
  const deliveryReady = useMemo(
    () => getEligibleOrdersForBatch(orders, "delivery").length,
    [orders],
  );

  return (
    <Screen>
      <View style={styles.content}>
        <AccountPanel />
        <Text style={styles.title}>Owner dashboard</Text>
        <Text style={styles.body}>
          Accept requests, manage order statuses, set prices, and assign driver
          batches.
        </Text>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.dashboardHeader}>
          <Text style={styles.dashboardTitle}>Needs attention</Text>
          <Text style={styles.dashboardSubtitle}>
            Tap a tile to open the matching filtered order view.
          </Text>
        </View>
        <View style={styles.dashboardGrid}>
          <DashboardCard
            href="/(admin)/orders?attention=new-requests"
            highlighted={newRequests > 0}
            label="New requests"
            tone="requests"
            value={newRequests}
          />
          <DashboardCard
            href="/(admin)/orders?attention=price-payment"
            label="Price/payment"
            tone="payment"
            value={pricingNeeded}
          />
          <DashboardCard
            href="/(admin)/orders?attention=pickup-ready"
            label="Pickup ready"
            tone="pickup"
            value={pickupReady}
          />
          <DashboardCard
            href="/(admin)/orders?attention=delivery-ready"
            label="Delivery ready"
            tone="delivery"
            value={deliveryReady}
          />
        </View>
        <DemoWalkthrough
          title="Owner demo path"
          steps={[
            "Open incoming orders and accept a new request.",
            "Move the order through in-store processing and save the final price.",
            "Create pickup or delivery batches and review submitted driver routes.",
          ]}
        />
        <View style={styles.actionPanel}>
          <Text style={styles.actionTitle}>Operations</Text>
          <Link href="/(admin)/orders" style={styles.primaryAction}>
            Open orders
          </Link>
          <View style={styles.actionGrid}>
            <Link href="/(admin)/batches" style={styles.secondaryAction}>
              Batch management
            </Link>
            <Link href="/(admin)/driver-tracking" style={styles.secondaryAction}>
              Driver tracking
            </Link>
            <Link href="/(admin)/reports" style={styles.secondaryAction}>
              Reports
            </Link>
            <Link href="/(admin)/rewards" style={styles.secondaryAction}>
              Rewards
            </Link>
            <Link href="/(admin)/recurring-orders" style={styles.secondaryAction}>
              Recurring orders
            </Link>
            <Link href="/(admin)/configuration" style={styles.secondaryAction}>
              Business configuration
            </Link>
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
  dashboardHeader: {
    gap: spacing.xs,
  },
  dashboardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  dashboardSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dashboardCard: {
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 5,
    flexBasis: 136,
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: "center",
    minHeight: 96,
    minWidth: 150,
    padding: spacing.sm,
  },
  dashboardCardContent: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    width: "100%",
  },
  dashboardTextGroup: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  dashboardCardRequests: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
  },
  dashboardCardPayment: {
    backgroundColor: "#EFF6FF",
    borderColor: "#60A5FA",
  },
  dashboardCardPickup: {
    backgroundColor: "#ECFDF5",
    borderColor: "#34D399",
  },
  dashboardCardDelivery: {
    backgroundColor: "#F5F3FF",
    borderColor: "#A78BFA",
  },
  dashboardCardHighlighted: {
    backgroundColor: "#FEF3C7",
    borderColor: "#D97706",
    borderWidth: 2,
    borderLeftWidth: 7,
  },
  dashboardLabel: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 13,
    textAlign: "left",
    textTransform: "uppercase",
    width: "100%",
  },
  dashboardLabelHighlighted: {
    color: "#92400E",
  },
  dashboardValue: {
    color: colors.text,
    fontSize: 44,
    fontWeight: "900",
    lineHeight: 48,
    minWidth: 54,
    textAlign: "right",
  },
  dashboardValueRequests: {
    color: "#92400E",
  },
  dashboardValuePayment: {
    color: "#1D4ED8",
  },
  dashboardValuePickup: {
    color: "#047857",
  },
  dashboardValueDelivery: {
    color: "#6D28D9",
  },
  dashboardValueHighlighted: {
    color: "#78350F",
  },
  dashboardStatus: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.7)",
    borderColor: "rgba(15,23,42,0.08)",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: "left",
    textTransform: "uppercase",
  },
  dashboardStatusHighlighted: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
    color: "#FFFFFF",
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
    minWidth: 180,
    padding: spacing.md,
    textAlign: "center",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
