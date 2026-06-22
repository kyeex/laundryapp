import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrderById, markOrderPaid } from "@/services/orderService";
import { createOrderPaymentIntent } from "@/services/paymentService";
import { initializeAndPresentPaymentSheet } from "@/services/stripePaymentSheet";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";

export default function CustomerPayOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);

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

  async function handlePay() {
    if (!order || !currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsPaying(true);

    try {
      const paymentSetup = await createOrderPaymentIntent(order.id);
      await initializeAndPresentPaymentSheet(paymentSetup);

      await markOrderPaid({
        orderId: order.id,
        customerId: currentUser.id,
      });

      setSuccess("Payment complete.");
      router.replace({
        pathname: "/(customer)/orders/[orderId]",
        params: { orderId: order.id },
      });
    } catch (payError) {
      const message =
        payError instanceof Error ? payError.message : "Unable to complete payment.";
      setError(message);
    } finally {
      setIsPaying(false);
    }
  }

  const canPay =
    Boolean(order?.finalPrice) && order?.paymentStatus !== "paid" && !isPaying;

  return (
    <Screen>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading && !order ? (
          <View style={styles.card}>
            <Text style={styles.title}>Order not found</Text>
            <Text style={styles.muted}>
              This order may not exist, or it may not belong to this account.
              Return to My orders and open an order with a final balance due.
            </Text>
          </View>
        ) : null}

        {order ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Payment</Text>
              <Text style={styles.title}>
                {order.finalPrice === null
                  ? "Final price pending"
                  : `$${order.finalPrice.toFixed(2)}`}
              </Text>
              <Text style={styles.muted}>Payment status: {order.paymentStatus}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Before you pay</Text>
              <Text style={styles.muted}>
                Stripe PaymentSheet will open after the backend creates a secure
                PaymentIntent for this order.
              </Text>
            </View>

            <AppButton
              disabled={!canPay}
              label={isPaying ? "Opening payment..." : "Pay with card"}
              onPress={handlePay}
            />
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
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
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
