import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { getAdminBatches } from "@/services/batchService";
import { formatAddress, getAdminOrders } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, BatchType, Order } from "@/types/domain";

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatBatchType(type: BatchType) {
  if (type === "pickup_delivery") {
    return "Pick Up + Delivery";
  }

  return type === "pickup" ? "Pickup" : "Delivery";
}

function getBatchOrderType(batch: Batch, order: Order): BatchType {
  if (batch.type !== "pickup_delivery") {
    return batch.type;
  }

  return order.deliveryBatchId === batch.id ? "delivery" : "pickup";
}

function getOrderSchedule(order: Order, type: BatchType) {
  return type === "delivery"
    ? `${order.scheduledDropoffDate} · ${order.scheduledDropoffWindow}`
    : `${order.scheduledPickupDate} · ${order.scheduledPickupWindow}`;
}

export default function AdminDriverTrackingScreen() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadTracking = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [adminBatches, adminOrders] = await Promise.all([
        getAdminBatches(),
        getAdminOrders(),
      ]);

      setBatches(adminBatches);
      setOrders(adminOrders);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load driver tracking right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTracking();
  }, [loadTracking]);

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const submittedBatchesByDriver = useMemo(() => {
    const submittedBatches = batches.filter((batch) => batch.status === "completed");

    return submittedBatches.reduce<Record<string, Batch[]>>((groups, batch) => {
      const driverName = batch.driverName || "Driver";

      return {
        ...groups,
        [driverName]: [...(groups[driverName] ?? []), batch],
      };
    }, {});
  }, [batches]);
  const driverNames = Object.keys(submittedBatchesByDriver);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Driver tracking</Text>
          <Text style={styles.body}>
            Review assigned routes that drivers finalized and submitted.
          </Text>
          <AppButton label="Refresh" onPress={loadTracking} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && driverNames.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No submitted routes yet</Text>
            <Text style={styles.emptyText}>
              Driver routes will appear here after a driver checks off stops and
              submits the route from the driver app. To create demo activity,
              assign a batch on Batch management, switch to Driver, mark stops,
              then submit the finalized route.
            </Text>
          </View>
        ) : null}

        {driverNames.map((driverName) => {
          const driverBatches = submittedBatchesByDriver[driverName] ?? [];
          const submittedStopCount = driverBatches.reduce(
            (total, batch) => total + batch.orderIds.length,
            0,
          );

          return (
            <View key={driverName} style={styles.section}>
              <View style={styles.driverHeader}>
                <View>
                  <Text style={styles.sectionTitle}>{driverName}</Text>
                  <Text style={styles.muted}>
                    {driverBatches.length} submitted route
                    {driverBatches.length === 1 ? "" : "s"} · {submittedStopCount} stop
                    {submittedStopCount === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              {driverBatches.map((batch) => (
                <View key={batch.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {formatBatchType(batch.type)} · {formatStatus(batch.status)}
                  </Text>
                  <Text style={styles.muted}>
                    Route date: {batch.scheduledDate}
                  </Text>
                  {batch.notes ? <Text style={styles.muted}>{batch.notes}</Text> : null}

                  <View style={styles.manifest}>
                    <Text style={styles.manifestTitle}>Submitted orders</Text>
                    {batch.orderIds.map((orderId) => {
                      const order = ordersById.get(orderId);

                      if (!order) {
                        return (
                          <Text key={orderId} style={styles.muted}>
                            {orderId} · order details unavailable
                          </Text>
                        );
                      }

                      const orderType = getBatchOrderType(batch, order);

                      return (
                        <View key={order.id} style={styles.orderItem}>
                          <Text style={styles.orderTitle}>
                            {order.customerName || "Customer"}
                          </Text>
                          <Text style={styles.muted}>
                            {formatBatchType(orderType)} · {getOrderSchedule(order, orderType)}
                          </Text>
                          <Text style={styles.muted}>
                            {formatAddress(order.addressSnapshot)}
                          </Text>
                          <Text style={styles.muted}>
                            {order.id} · {formatStatus(order.status)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.sm,
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
  section: {
    gap: spacing.sm,
  },
  driverHeader: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  manifest: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  manifestTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  orderItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  orderTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
