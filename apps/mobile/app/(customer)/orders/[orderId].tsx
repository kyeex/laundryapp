import { Link, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { OrderTimeline } from "@/components/OrderTimeline";
import { Screen } from "@/components/Screen";
import {
  calculateBillableLaundryWeight,
} from "@/data/pricing";
import { serviceCatalog } from "@/data/serviceCatalog";
import { useAuth } from "@/context/AuthContext";
import { formatAddress, getCustomerOrderById } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

export default function CustomerOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!currentUser || !orderId) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const customerOrder = await getCustomerOrderById(currentUser.id, orderId);
      setOrder(customerOrder);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this order right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const serviceNames = useMemo(() => {
    if (!order) {
      return "";
    }

    return order.selectedServiceIds
      .map((serviceId) => serviceCatalog.find((service) => service.id === serviceId)?.name)
      .filter(Boolean)
      .join(", ");
  }, [order]);

  return (
    <Screen>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && !order ? (
          <View style={styles.card}>
            <Text style={styles.title}>Order not found</Text>
            <Text style={styles.muted}>
              This order may not exist, or it may not belong to this account.
              Return to My orders and open an order from the current account.
            </Text>
          </View>
        ) : null}

        {order ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Order request</Text>
              <Text style={styles.title}>{formatOrderStatus(order.status)}</Text>
              <Text style={styles.muted}>
                Pickup {order.scheduledPickupDate} · Drop-off{" "}
                {order.scheduledDropoffDate}
              </Text>
            </View>

            <OrderTimeline status={order.status} />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Service</Text>
              <Text style={styles.value}>{serviceNames || "Service not found"}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Estimate</Text>
              <Text style={styles.value}>
                Laundry:{" "}
                {order.estimatedWeightPounds
                  ? `${calculateBillableLaundryWeight(order.estimatedWeightPounds, {
                      deliveryMinimumPounds: order.deliveryMinimumPounds,
                      laundryPricePerPound: order.laundryPricePerPound,
                    }).toFixed(1)} billable lb x $${order.laundryPricePerPound.toFixed(2)}/lb`
                  : "Weight pending"}
              </Text>
              {order.estimatedWeightPounds &&
              order.estimatedWeightPounds < order.deliveryMinimumPounds ? (
                <Text style={styles.muted}>
                  Customer estimated {order.estimatedWeightPounds.toFixed(1)} lb;
                  the {order.deliveryMinimumPounds} lb delivery minimum applies.
                </Text>
              ) : null}
              <Text style={styles.value}>
                Gratuity: ${order.gratuityAmount.toFixed(2)}
              </Text>
              <Text style={styles.value}>
                Estimated total: ${order.estimatedSubtotal.toFixed(2)}
              </Text>
              <Text style={styles.muted}>
                Final price is confirmed after the owner weighs and reviews the
                order.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add-ons</Text>
              {order.selectedAddOns.length === 0 ? (
                <Text style={styles.muted}>No add-ons selected.</Text>
              ) : (
                order.selectedAddOns.map((addOn) => (
                  <Text key={addOn.id} style={styles.value}>
                    {(addOn.quantity ?? 1) > 1 ? `${addOn.quantity} x ` : ""}
                    {addOn.name} ·{" "}
                    {addOn.price === null ? "Owner confirms" : `$${addOn.price.toFixed(2)}`}
                  </Text>
                ))
              )}
              <Text style={styles.muted}>
                Fixed add-ons are included in the estimate above.
              </Text>
            </View>

            {order.selectedDryCleaningItems.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Dry cleaning items</Text>
                {order.selectedDryCleaningItems.map((item) => (
                  <Text key={item.id} style={styles.value}>
                    {(item.quantity ?? 1) > 1 ? `${item.quantity} x ` : ""}
                    {item.name} · ${item.price.toFixed(2)}
                  </Text>
                ))}
                <Text style={styles.muted}>
                  These items are included in the estimate above.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Customer address</Text>
              <Text style={styles.value}>{formatAddress(order.addressSnapshot)}</Text>
              {order.addressSnapshot.deliveryInstructions ? (
                <Text style={styles.muted}>
                  {order.addressSnapshot.deliveryInstructions}
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Schedule</Text>
              <Text style={styles.value}>
                Pickup: {order.scheduledPickupDate} · {order.scheduledPickupWindow}
              </Text>
              <Text style={styles.value}>
                Drop-off: {order.scheduledDropoffDate} ·{" "}
                {order.scheduledDropoffWindow}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment</Text>
              <Text style={styles.value}>
                {order.finalPrice === null
                  ? "Final price pending"
                  : `$${order.finalPrice.toFixed(2)}`}
              </Text>
              <Text style={styles.muted}>Payment status: {order.paymentStatus}</Text>
              {order.finalPrice !== null && order.paymentStatus !== "paid" ? (
                <Link
                  href={{
                    pathname: "/(customer)/orders/[orderId]/pay",
                    params: { orderId: order.id },
                  }}
                  style={styles.payLink}
                >
                  Pay final balance
                </Link>
              ) : null}
            </View>

            {order.customerNotes ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Your notes</Text>
                <Text style={styles.value}>{order.customerNotes}</Text>
              </View>
            ) : null}

            <AppButton
              label="Track order status"
              onPress={() =>
                router.push({
                  pathname: "/(customer)/orders/[orderId]/track",
                  params: { orderId: order.id },
                })
              }
            />
            <AppButton label="Refresh order" onPress={loadOrder} variant="secondary" />
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
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  value: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  payLink: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
