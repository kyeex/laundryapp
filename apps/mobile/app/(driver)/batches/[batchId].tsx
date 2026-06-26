import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { DriverRouteTimeline } from "@/components/OrderTimeline";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  getBatchById,
  getBatchOrders,
  updateDriverOrderStop,
} from "@/services/batchService";
import { formatAddress } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, BatchType, Order, OrderStatus } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

function formatStatus(status: string) {
  return formatOrderStatus(status);
}

function formatBatchType(type: BatchType) {
  if (type === "pickup_delivery") {
    return "Pick Up + Delivery";
  }

  return type === "pickup" ? "Pickup" : "Delivery";
}

function isPickupStop(batch: Batch, order: Order) {
  if (batch.type === "pickup") {
    return true;
  }

  if (batch.type === "delivery") {
    return false;
  }

  return order.pickupBatchId === batch.id || order.status === "pickup_assigned";
}

function getCompletedStatus(batch: Batch, order: Order): OrderStatus {
  return isPickupStop(batch, order) ? "picked_up" : "delivered";
}

function getAssignedStatus(batch: Batch, order: Order): OrderStatus {
  return isPickupStop(batch, order) ? "pickup_assigned" : "delivery_assigned";
}

function getFailedStatus(batch: Batch, order: Order): OrderStatus {
  return isPickupStop(batch, order) ? "failed_pickup" : "failed_delivery";
}

function isStopCompleted(batch: Batch, order: Order) {
  return order.status === getCompletedStatus(batch, order);
}

export default function DriverBatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const { currentUser } = useAuth();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState("");

  const selectedOrders = useMemo(
    () => (batch ? orders.filter((order) => isStopCompleted(batch, order)) : []),
    [batch, orders],
  );
  const routeIsCompleted = batch?.status === "completed";
  const stopActionLabel = useMemo(() => {
    if (!batch || batch.type === "pickup_delivery") {
      return "Marked picked up / delivered";
    }

    return batch.type === "pickup" ? "Marked picked up" : "Marked delivered";
  }, [batch]);

  const loadBatch = useCallback(async () => {
    if (!batchId || !currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const driverBatch = await getBatchById(batchId);

      if (!driverBatch || driverBatch.driverId !== currentUser.id) {
        setBatch(null);
        setOrders([]);
        return;
      }

      const batchOrders = await getBatchOrders(driverBatch);
      setBatch(driverBatch);
      setOrders(batchOrders);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this batch right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, currentUser]);

  useEffect(() => {
    void loadBatch();
  }, [loadBatch]);

  async function handleStopUpdate(order: Order, toStatus: OrderStatus) {
    if (!batch || !currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setSavingOrderId(order.id);

    try {
      await updateDriverOrderStop({
        batch,
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        driverId: currentUser.id,
      });
      setSuccess(
        toStatus === "pickup_assigned" || toStatus === "delivery_assigned"
          ? "Stop unchecked."
          : `Stop updated to ${formatStatus(toStatus)}.`,
      );
      await loadBatch();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update this stop right now.";
      setError(message);
    } finally {
      setSavingOrderId("");
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading && !batch ? (
          <View style={styles.card}>
            <Text style={styles.title}>Batch not found</Text>
            <Text style={styles.muted}>
              This batch may not exist, or it may not be assigned to your account.
              Return to Assigned batches to choose a route that belongs to the
              signed-in driver.
            </Text>
          </View>
        ) : null}

        {batch ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>{formatBatchType(batch.type)} batch</Text>
              <Text style={styles.title}>{formatStatus(batch.status)}</Text>
              <Text style={styles.muted}>
                {formatDisplayDate(batch.scheduledDate)} · {orders.length} stop
                {orders.length === 1 ? "" : "s"}
              </Text>
            </View>

            <DriverRouteTimeline
              batchStatus={batch.status}
              completedStops={selectedOrders.length}
              stopActionLabel={stopActionLabel}
              totalStops={orders.length}
            />

            {batch.notes ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Driver notes</Text>
                <Text style={styles.value}>{batch.notes}</Text>
              </View>
            ) : null}

            {routeIsCompleted ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Route submitted</Text>
                <Text style={styles.muted}>
                  This route has already been finalized and submitted to the owner.
                </Text>
              </View>
            ) : (
              <AppButton
                disabled={selectedOrders.length === 0}
                label="Finalize and submit route"
                onPress={() =>
                  router.push({
                    pathname: "/(driver)/batches/[batchId]/finalize",
                    params: {
                      batchId: batch.id,
                      orderIds: selectedOrders.map((order) => order.id).join(","),
                    },
                  })
                }
              />
            )}
            {!routeIsCompleted && selectedOrders.length === 0 ? (
              <Text style={styles.muted}>
                Select at least one completed stop before finalizing the route.
              </Text>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stops</Text>
              {orders.map((order) => {
                const completed = isStopCompleted(batch, order);

                return (
                  <View
                    key={order.id}
                    style={[styles.card, completed && styles.completedCard]}
                  >
                    <View style={styles.stopHeader}>
                      <Text style={styles.cardTitle}>
                        {order.customerName || "Customer"}
                      </Text>
                      {completed ? (
                        <View style={styles.checkBadge}>
                          <Text style={styles.checkBadgeText}>✓</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.value}>
                      {formatAddress(order.addressSnapshot)}
                    </Text>
                    <Text style={styles.muted}>
                      Status: {formatStatus(order.status)}
                    </Text>
                    {order.customerNotes ? (
                      <Text style={styles.muted}>{order.customerNotes}</Text>
                    ) : null}
                    <View style={styles.actions}>
                      <AppButton
                        disabled={routeIsCompleted || savingOrderId === order.id}
                        label={
                          completed
                            ? "Undo stop"
                            : isPickupStop(batch, order)
                              ? "Mark picked up"
                              : "Mark delivered"
                        }
                        onPress={() =>
                          handleStopUpdate(
                            order,
                            completed
                              ? getAssignedStatus(batch, order)
                              : getCompletedStatus(batch, order),
                          )
                        }
                        variant={completed ? "secondary" : "primary"}
                      />
                      <AppButton
                        disabled={routeIsCompleted || savingOrderId === order.id || completed}
                        label="Mark failed attempt"
                        onPress={() =>
                          handleStopUpdate(order, getFailedStatus(batch, order))
                        }
                        variant="secondary"
                      />
                    </View>
                  </View>
                );
              })}
            </View>

            <AppButton label="Refresh batch" onPress={loadBatch} variant="secondary" />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  section: {
    gap: spacing.sm,
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
  completedCard: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  stopHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  checkBadge: {
    alignItems: "center",
    backgroundColor: colors.success,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  checkBadgeText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  value: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
});
