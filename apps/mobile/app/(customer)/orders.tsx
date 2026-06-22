import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrders } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

export default function CustomerOrdersScreen() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const customerOrders = await getCustomerOrders(currentUser.id);
      setOrders(customerOrders);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load orders right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>My orders</Text>
          <AppButton label="Refresh" onPress={loadOrders} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Submitted orders appear here with tracking, payment, and final
              pricing details. Start a new order, review the estimate, and submit
              it to see the customer workflow come alive.
            </Text>
            <Link href="/(customer)/new-order" style={styles.action}>
              Start new order
            </Link>
          </View>
        ) : null}

        <View style={styles.list}>
          {orders.map((order) => (
            <Link
              href={{
                pathname: "/(customer)/orders/[orderId]",
                params: { orderId: order.id },
              }}
              key={order.id}
              style={styles.card}
            >
              <Text style={styles.cardTitle}>{formatOrderStatus(order.status)}</Text>
              <Text style={styles.cardMeta}>
                Pickup {order.scheduledPickupDate} · {order.scheduledPickupWindow}
              </Text>
              <Text style={styles.cardMeta}>
                Drop-off {order.scheduledDropoffDate} · {order.scheduledDropoffWindow}
              </Text>
              <Text style={styles.cardMeta}>
                Estimate: ${order.estimatedSubtotal.toFixed(2)}
              </Text>
              <Text style={styles.cardMeta}>
                {order.selectedAddOns.length + order.selectedDryCleaningItems.length} extra
                {order.selectedAddOns.length + order.selectedDryCleaningItems.length === 1
                  ? ""
                  : "s"}
              </Text>
            </Link>
          ))}
        </View>
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
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xs,
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
  action: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
