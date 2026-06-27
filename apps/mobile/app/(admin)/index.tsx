import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

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
import { Screen } from "@/components/Screen";
import { getEligibleOrdersForBatch } from "@/services/batchService";
import { getAdminOrders } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";

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
        <PageHeader
          eyebrow="Owner"
          title="Owner dashboard"
          description="Accept requests, manage order statuses, set prices, and assign driver batches."
        />
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.dashboardHeader}>
          <Text style={styles.dashboardTitle}>Needs attention</Text>
          <Text style={styles.dashboardSubtitle}>
            Tap a tile to open the matching filtered order view.
          </Text>
        </View>
        <MetricGrid>
          <MetricCard
            href="/(admin)/orders?attention=new-requests"
            label="New requests"
            note="Orders waiting for accept or decline."
            status={newRequests > 0 ? "Review" : "Clear"}
            tone={newRequests > 0 ? "attention" : "neutral"}
            value={`${newRequests}`}
          />
          <MetricCard
            href="/(admin)/orders?attention=price-payment"
            label="Price/payment"
            note="Orders needing price or payment finalization."
            status={pricingNeeded > 0 ? "Open" : "Clear"}
            tone={pricingNeeded > 0 ? "info" : "neutral"}
            value={`${pricingNeeded}`}
          />
          <MetricCard
            href="/(admin)/orders?attention=pickup-ready"
            label="Pickup ready"
            note="Accepted orders eligible for pickup batching."
            status={pickupReady > 0 ? "Open" : "Clear"}
            tone={pickupReady > 0 ? "success" : "neutral"}
            value={`${pickupReady}`}
          />
          <MetricCard
            href="/(admin)/orders?attention=delivery-ready"
            label="Delivery ready"
            note="Orders ready for delivery batching."
            status={deliveryReady > 0 ? "Open" : "Clear"}
            tone={deliveryReady > 0 ? "accent" : "neutral"}
            value={`${deliveryReady}`}
          />
        </MetricGrid>
        <DemoWalkthrough
          title="Owner demo path"
          steps={[
            "Open incoming orders and accept a new request.",
            "Move the order through in-store processing and save the final price.",
            "Create pickup or delivery batches and review submitted driver routes.",
          ]}
        />
        <ActionPanel title="Operations">
          <ActionLink href="/(admin)/orders" label="Open orders" primary />
          <ActionGrid>
            <ActionLink href="/(admin)/batches" label="Batch management" />
            <ActionLink href="/(admin)/driver-tracking" label="Driver tracking" />
            <ActionLink href="/(admin)/reports" label="Reports" />
            <ActionLink href="/(admin)/rewards" label="Rewards" />
            <ActionLink href="/(admin)/recurring-orders" label="Recurring orders" />
            <ActionLink href="/(admin)/configuration" label="Business configuration" />
          </ActionGrid>
        </ActionPanel>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
