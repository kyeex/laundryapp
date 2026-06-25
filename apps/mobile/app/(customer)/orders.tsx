import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrders, getOrderNumber } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

function formatServiceName(serviceId: string) {
  const serviceNames: Record<string, string> = {
    "wash-fold": "Wash and fold",
    "wash-fold-dry-cleaning": "Wash and fold + dry cleaning",
  };

  return serviceNames[serviceId] ?? serviceId;
}

function getServiceSummary(order: Order) {
  return order.selectedServiceIds.map(formatServiceName).join(", ") || "Laundry order";
}

function getAddressSummary(order: Order) {
  const address = order.addressSnapshot;
  return [address.street1, address.city, address.state].filter(Boolean).join(", ");
}

function getExtrasCount(order: Order) {
  return order.selectedAddOns.length + order.selectedDryCleaningItems.length;
}

function getExtrasPreview(order: Order) {
  const extras = [...order.selectedAddOns, ...order.selectedDryCleaningItems]
    .slice(0, 3)
    .map((item) => `${item.quantity && item.quantity > 1 ? `${item.quantity} x ` : ""}${item.name}`);

  if (extras.length === 0) {
    return "No add-ons selected";
  }

  const remainingCount = getExtrasCount(order) - extras.length;
  return remainingCount > 0
    ? `${extras.join(", ")} + ${remainingCount} more`
    : extras.join(", ");
}

function getOrderTotal(order: Order) {
  return order.finalPrice ?? order.estimatedSubtotal;
}

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
              asChild
              href={{
                pathname: "/(customer)/my-orders/[orderId]",
                params: { orderId: order.id },
              }}
              key={order.id}
            >
              <Pressable style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleBlock}>
                    <Text style={styles.orderNumber}>#{getOrderNumber(order)}</Text>
                    <Text style={styles.cardTitle}>{getServiceSummary(order)}</Text>
                  </View>
                  <Text style={styles.statusPill}>
                    {formatOrderStatus(order.status)}
                  </Text>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Pickup</Text>
                    <Text style={styles.detailValue}>
                      {formatDisplayDate(order.scheduledPickupDate)}
                    </Text>
                    <Text style={styles.detailMeta}>{order.scheduledPickupWindow}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Drop-off</Text>
                    <Text style={styles.detailValue}>
                      {formatDisplayDate(order.scheduledDropoffDate)}
                    </Text>
                    <Text style={styles.detailMeta}>{order.scheduledDropoffWindow}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Total</Text>
                    <Text style={styles.detailValue}>
                      ${getOrderTotal(order).toFixed(2)}
                    </Text>
                    <Text style={styles.detailMeta}>
                      {order.finalPrice === null ? "Estimated" : "Final"}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Payment</Text>
                    <Text style={styles.detailValue}>
                      {formatOrderStatus(order.paymentStatus)}
                    </Text>
                    <Text style={styles.detailMeta}>Payment status</Text>
                  </View>
                </View>

                <View style={styles.previewPanel}>
                  <Text style={styles.previewLabel}>Order preview</Text>
                  <Text style={styles.previewText}>{getExtrasPreview(order)}</Text>
                  <Text style={styles.previewMeta}>
                    {order.estimatedWeightPounds
                      ? `${order.estimatedWeightPounds} lb estimate`
                      : "No weight estimate"}{" "}
                    · {getAddressSummary(order) || "Address on file"}
                  </Text>
                </View>

                <Text style={styles.openAction}>View order details</Text>
              </Pressable>
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
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  cardTitleBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  orderNumber: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  statusPill: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 150,
    padding: spacing.sm,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  detailMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  previewPanel: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  previewText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  previewMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  openAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
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
