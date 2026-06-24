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

function DashboardCard({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <Link href={href} style={styles.dashboardCard}>
      <Text style={styles.dashboardLabel}>{label}</Text>
      <Text style={styles.dashboardValue}>{value}</Text>
      <Text style={styles.dashboardNote}>{note}</Text>
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
        <View style={styles.dashboardGrid}>
          <DashboardCard
            href="/(admin)/orders?attention=new-requests"
            label="New requests"
            note="Need accept or decline."
            value={`${newRequests}`}
          />
          <DashboardCard
            href="/(admin)/orders?attention=price-payment"
            label="Price/payment"
            note="Need final price or payment finalization."
            value={`${pricingNeeded}`}
          />
          <DashboardCard
            href="/(admin)/orders?attention=pickup-ready"
            label="Pickup ready"
            note="Accepted orders ready for pickup batching."
            value={`${pickupReady}`}
          />
          <DashboardCard
            href="/(admin)/orders?attention=delivery-ready"
            label="Delivery ready"
            note="Orders ready for delivery batching."
            value={`${deliveryReady}`}
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
        <Link href="/(admin)/orders" style={styles.link}>
          Incoming orders
        </Link>
        <Link href="/(admin)/driver-tracking" style={styles.link}>
          Driver tracking
        </Link>
        <Link href="/(admin)/batches" style={styles.link}>
          Batch management
        </Link>
        <Link href="/(admin)/configuration" style={styles.link}>
          Business configuration
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
  link: {
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
    minWidth: 160,
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
    fontSize: 22,
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
