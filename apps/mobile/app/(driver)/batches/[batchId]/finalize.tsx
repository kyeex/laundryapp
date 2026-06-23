import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  getBatchById,
  getBatchOrders,
  updateBatchStatus,
} from "@/services/batchService";
import { formatAddress } from "@/services/orderService";
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

function isPickupStop(batch: Batch, order: Order) {
  if (batch.type === "pickup") {
    return true;
  }

  if (batch.type === "delivery") {
    return false;
  }

  return order.pickupBatchId === batch.id || order.status === "pickup_assigned";
}

function isSubmittedStop(batch: Batch, order: Order) {
  return isPickupStop(batch, order)
    ? order.status === "picked_up"
    : order.status === "delivered";
}

export default function DriverFinalizeRouteScreen() {
  const { batchId, orderIds } = useLocalSearchParams<{
    batchId: string;
    orderIds?: string;
  }>();
  const { currentUser } = useAuth();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedOrderIds = useMemo(
    () => new Set((orderIds ?? "").split(",").filter(Boolean)),
    [orderIds],
  );

  const selectedOrders = useMemo(
    () =>
      batch
        ? orders.filter(
            (order) => selectedOrderIds.has(order.id) && isSubmittedStop(batch, order),
          )
        : [],
    [batch, orders, selectedOrderIds],
  );

  const loadRoute = useCallback(async () => {
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
          : "Unable to load route confirmation right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, currentUser]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  async function handleSubmitRoute() {
    if (!batch || !currentUser || selectedOrders.length === 0) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await updateBatchStatus({
        batchId: batch.id,
        status: "completed",
        driverId: currentUser.id,
      });
      setSuccess("Route submitted successfully.");
      router.replace("/(driver)/batches");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit this route right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
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
            <Text style={styles.title}>Route not found</Text>
            <Text style={styles.muted}>
              This route may not exist, or it may not be assigned to your account.
              Return to Assigned batches and open a route assigned to the signed-in
              driver.
            </Text>
          </View>
        ) : null}

        {batch ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Finalize route</Text>
              <Text style={styles.title}>{formatBatchType(batch.type)}</Text>
              <Text style={styles.muted}>
                {batch.scheduledDate} · {selectedOrders.length} selected stop
                {selectedOrders.length === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Route confirmation</Text>
              <Text style={styles.value}>
                Review the selected stops below before submitting this route.
              </Text>
              <Text style={styles.muted}>
                Batch status: {formatStatus(batch.status)}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Selected orders</Text>
              {selectedOrders.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>No selected stops</Text>
                  <Text style={styles.muted}>
                    Return to the batch stops page and mark at least one stop before
                    finalizing. Only stops checked off as picked up or delivered can
                    be submitted.
                  </Text>
                </View>
              ) : null}
              {selectedOrders.map((order) => (
                <View key={order.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {order.customerName || "Customer"}
                  </Text>
                  <Text style={styles.value}>{formatAddress(order.addressSnapshot)}</Text>
                  <Text style={styles.muted}>
                    Submitted as: {formatStatus(order.status)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <AppButton
                disabled={isSubmitting || selectedOrders.length === 0}
                label={isSubmitting ? "Submitting..." : "Submit finalized route"}
                onPress={handleSubmitRoute}
              />
              <AppButton
                disabled={isSubmitting}
                label="Back to route stops"
                onPress={() =>
                  router.replace({
                    pathname: "/(driver)/batches/[batchId]",
                    params: { batchId: batch.id },
                  })
                }
                variant="secondary"
              />
            </View>
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
