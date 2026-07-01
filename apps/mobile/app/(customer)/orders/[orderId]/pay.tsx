import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { shouldUseDemoBackend } from "@/config/firebase";
import { useAuth } from "@/context/AuthContext";
import { getCustomerOrderById } from "@/services/orderService";
import {
  chargeSavedOrderPayment,
  confirmOrderPayment,
  createOrderPaymentIntent,
} from "@/services/paymentService";
import {
  getCustomerProfileSummary,
  type CustomerPaymentMethod,
} from "@/services/profileService";
import {
  calculatePointsForRewardCredit,
  calculateRewardCredit,
  getCustomerLoyaltyRewards,
  getLoyaltyRewardSettings,
  redeemRewardsForOrder,
  type LoyaltyRewardsAccount,
} from "@/services/loyaltyRewardsService";
import { initializeAndPresentPaymentSheet } from "@/services/stripePaymentSheet";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { LoyaltyRewardSettings, Order, OrderStatus } from "@/types/domain";

const rewardCreditOptions = [0, 1, 2, 5, 10];
const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isStripeMobileCheckoutConfigured =
  stripePublishableKey.startsWith("pk_test_") ||
  stripePublishableKey.startsWith("pk_live_");
const payableOrderStatuses = new Set<OrderStatus>([
  "accepted",
  "received_at_store",
  "in_progress",
  "priced",
  "payment_requested",
  "ready_for_delivery",
]);

export default function CustomerPayOrderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CustomerPaymentMethod | null>(null);
  const [rewardsAccount, setRewardsAccount] = useState<LoyaltyRewardsAccount | null>(
    null,
  );
  const [rewardSettings, setRewardSettings] = useState<LoyaltyRewardSettings | null>(
    null,
  );
  const [selectedRewardCredit, setSelectedRewardCredit] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState("");

  const loadOrder = useCallback(async () => {
    if (!currentUser || !orderId) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [customerOrder, profile] = await Promise.all([
        getCustomerOrderById(currentUser.id, orderId),
        getCustomerProfileSummary(currentUser.id),
      ]);
      const settings = await getLoyaltyRewardSettings();
      const customerRewards = settings.enabled
        ? await getCustomerLoyaltyRewards(
            currentUser.id,
            currentUser.displayName || currentUser.email || "Customer",
          )
        : null;

      setOrder(customerOrder);
      setPaymentMethod(profile.paymentMethod);
      setRewardsAccount(customerRewards);
      setRewardSettings(settings);
      setSelectedRewardCredit(0);
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
    setPaymentStep("Preparing secure checkout...");
    setIsPaying(true);

    try {
      if (!shouldUseDemoBackend && hasSavedPaymentMethod) {
        setPaymentStep("Charging saved card securely...");
        await chargeSavedOrderPayment(order.id, selectedRewardCredit);
      } else {
        const paymentSetup = await createOrderPaymentIntent(
          order.id,
          selectedRewardCredit,
        );
        setPaymentStep("Opening Stripe secure payment...");
        await initializeAndPresentPaymentSheet(paymentSetup);
        setPaymentStep("Confirming payment...");
        await confirmOrderPayment(order.id);
      }

      if (shouldUseDemoBackend && selectedRewardCredit > 0) {
        await redeemRewardsForOrder({
          actorId: currentUser.id,
          customerId: currentUser.id,
          customerName: currentUser.displayName || currentUser.email || "Customer",
          orderId: order.id,
          rewardCreditDollars: selectedRewardCredit,
        });
      }

      setSuccess("Payment complete.");
      await loadOrder();
      router.replace({
        pathname: "/(customer)/my-orders/[orderId]",
        params: { orderId: order.id },
      });
    } catch (payError) {
      const message =
        payError instanceof Error ? payError.message : "Unable to complete payment.";
      setError(
        message.toLowerCase().includes("cancel")
          ? "Payment was canceled. No charge was completed."
          : message,
      );
    } finally {
      setPaymentStep("");
      setIsPaying(false);
    }
  }

  const availableRewardCredit =
    rewardsAccount && rewardSettings
      ? calculateRewardCredit(rewardsAccount.pointsBalance, rewardSettings)
      : 0;
  const finalPrice = order?.finalPrice ?? 0;
  const payableAmount = Math.max(0, finalPrice - selectedRewardCredit);
  const isPaymentEligible =
    Boolean(order && payableOrderStatuses.has(order.status)) &&
    order?.paymentStatus !== "paid";
  const hasSavedPaymentMethod = Boolean(
    paymentMethod?.brand &&
      paymentMethod.last4 &&
      paymentMethod.expirationMonth &&
      paymentMethod.stripeCustomerId &&
      paymentMethod.stripePaymentMethodId,
  );
  const canUseSavedProfileCard = !shouldUseDemoBackend && hasSavedPaymentMethod;
  const canPay =
    isPaymentEligible &&
    (canUseSavedProfileCard || isStripeMobileCheckoutConfigured) &&
    finalPrice > 0 &&
    payableAmount > 0 &&
    !isPaying;
  const paymentDisabledReason =
    !canUseSavedProfileCard && !isStripeMobileCheckoutConfigured
      ? "Stripe checkout is not configured in this build. Save a profile card first or rebuild with a valid Stripe publishable key."
      : order?.paymentStatus === "paid"
      ? "This order has already been paid."
      : !isPaymentEligible
        ? "This order is not ready for payment yet."
        : finalPrice <= 0
          ? "The owner must set a final price before payment."
          : payableAmount <= 0
            ? "Rewards cannot cover the entire balance yet."
            : "";

  return (
    <Screen>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}
        {paymentStep ? <Text style={styles.pending}>{paymentStep}</Text> : null}

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
              {paymentDisabledReason ? (
                <Text style={styles.muted}>{paymentDisabledReason}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Before you pay</Text>
              <Text style={styles.muted}>
                {canUseSavedProfileCard
                  ? "Your saved profile card can be charged securely by the backend for this final balance."
                  : "Stripe PaymentSheet will open after the backend creates a secure PaymentIntent for this order."}
              </Text>
              <Text
                style={
                  canUseSavedProfileCard || isStripeMobileCheckoutConfigured
                    ? styles.checkoutReady
                    : styles.checkoutBlocked
                }
              >
                {canUseSavedProfileCard
                  ? "Saved profile card is ready for payment."
                  : isStripeMobileCheckoutConfigured
                  ? "Stripe checkout is configured for this build."
                  : "Native Stripe checkout is missing a valid publishable key."}
              </Text>
            </View>

            {rewardSettings?.enabled ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Apply rewards</Text>
                <Text style={styles.muted}>
                  {rewardsAccount
                    ? `${rewardsAccount.pointsBalance} points available. Choose a credit to apply before checkout.`
                    : "Rewards are loading for this customer."}
                </Text>
                <View style={styles.rewardGrid}>
                  {rewardCreditOptions.map((credit) => {
                    const pointsNeeded = rewardSettings
                      ? calculatePointsForRewardCredit(credit, rewardSettings)
                      : credit * 100;
                    const disabled =
                      credit > availableRewardCredit || credit > finalPrice || isPaying;
                    const selected = selectedRewardCredit === credit;

                    return (
                      <AppButton
                        disabled={disabled}
                        key={credit}
                        label={
                          credit === 0 ? "No credit" : `$${credit} (${pointsNeeded} pts)`
                        }
                        onPress={() => setSelectedRewardCredit(credit)}
                        variant={selected ? "primary" : "secondary"}
                      />
                    );
                  })}
                </View>
                <View style={styles.paymentSummary}>
                  <Text style={styles.value}>Final price: ${finalPrice.toFixed(2)}</Text>
                  <Text style={styles.value}>
                    Rewards credit: -${selectedRewardCredit.toFixed(2)}
                  </Text>
                  <Text style={styles.totalDue}>Amount due: ${payableAmount.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Payment method</Text>
              {hasSavedPaymentMethod ? (
                <>
                  <Text style={styles.value}>
                    {paymentMethod?.brand} ending in {paymentMethod?.last4}
                  </Text>
                  <Text style={styles.muted}>
                    Expires {paymentMethod?.expirationMonth}/
                    {paymentMethod?.expirationYear || "YYYY"}
                  </Text>
                </>
              ) : (
                <Text style={styles.muted}>
                  Stripe PaymentSheet will collect card details securely during checkout.
                  You can also save a default card from your profile for faster payment.
                </Text>
              )}
            </View>

            <AppButton
              disabled={!canPay}
              label={
                isPaying
                  ? "Processing payment..."
                  : canUseSavedProfileCard
                    ? "Pay with saved card"
                    : "Pay securely with Stripe"
              }
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
  rewardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  paymentSummary: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  totalDue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
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
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
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
  checkoutReady: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
  },
  checkoutBlocked: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
  pending: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
});
