import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import {
  calculateBillableLaundryWeight,
  calculateLaundryEstimate,
} from "@/data/pricing";
import {
  clearOrderDraft,
  getOrderDraft,
  type OrderDraft,
} from "@/data/orderDraftStore";
import { serviceCatalog } from "@/data/serviceCatalog";
import { authorizeDemoOrderPayment } from "@/services/demoPaymentService";
import {
  calculateEarnedPoints,
  getLoyaltyRewardSettings,
} from "@/services/loyaltyRewardsService";
import { createCustomerOrder } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { LoyaltyRewardSettings } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";

export default function OrderReviewScreen() {
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [demoPaymentAuthorized, setDemoPaymentAuthorized] = useState(false);
  const [demoPaymentReference, setDemoPaymentReference] = useState("");
  const [error, setError] = useState("");
  const [rewardSettings, setRewardSettings] = useState<LoyaltyRewardSettings | null>(
    null,
  );
  const [isAuthorizingPayment, setIsAuthorizingPayment] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(getOrderDraft());

    async function loadRewards() {
      try {
        setRewardSettings(await getLoyaltyRewardSettings());
      } catch {
        setRewardSettings(null);
      }
    }

    void loadRewards();
  }, []);

  const serviceNames = useMemo(() => {
    if (!draft) {
      return "";
    }

    return draft.input.selectedServiceIds
      .map((serviceId) => serviceCatalog.find((service) => service.id === serviceId)?.name)
      .filter(Boolean)
      .join(", ");
  }, [draft]);

  const addOnsSubtotal = useMemo(
    () =>
      draft?.input.selectedAddOns.reduce(
        (total, addOn) => total + (addOn.price ?? 0) * (addOn.quantity ?? 1),
        0,
      ) ?? 0,
    [draft],
  );
  const dryCleaningSubtotal = useMemo(
    () =>
      draft?.input.selectedDryCleaningItems.reduce(
        (total, item) => total + item.price * (item.quantity ?? 1),
        0,
      ) ?? 0,
    [draft],
  );
  const billableLaundryWeight = calculateBillableLaundryWeight(
    draft?.input.estimatedWeightPounds ?? 0,
    {
      deliveryMinimumPounds: draft?.input.deliveryMinimumPounds,
      laundryPricePerPound: draft?.input.laundryPricePerPound,
    },
  );
  const laundryEstimate = calculateLaundryEstimate(
    draft?.input.estimatedWeightPounds ?? 0,
    {
      deliveryMinimumPounds: draft?.input.deliveryMinimumPounds,
      laundryPricePerPound: draft?.input.laundryPricePerPound,
    },
  );
  const gratuityAmount = draft?.input.gratuityAmount ?? 0;
  const estimatedTotalBeforeGratuity =
    laundryEstimate + addOnsSubtotal + dryCleaningSubtotal;
  const estimatedTotal = estimatedTotalBeforeGratuity + gratuityAmount;
  const potentialRewardPoints =
    rewardSettings?.enabled ? calculateEarnedPoints(estimatedTotal, rewardSettings) : 0;

  async function handleAuthorizeDemoPayment() {
    setError("");
    setIsAuthorizingPayment(true);

    try {
      const authorization = await authorizeDemoOrderPayment({
        estimatedTotal,
      });
      setDemoPaymentAuthorized(true);
      setDemoPaymentReference(authorization.id);
    } catch (paymentError) {
      const message =
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to authorize demo payment.";
      setError(message);
    } finally {
      setIsAuthorizingPayment(false);
    }
  }

  async function handlePlaceOrder() {
    if (!draft) {
      setError("Order draft not found. Please start a new order.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      if (!demoPaymentAuthorized) {
        throw new Error("Authorize demo payment before placing the order.");
      }

      const orderId = await createCustomerOrder(draft.customer, draft.input);
      clearOrderDraft();
      router.replace({
        pathname: "/(customer)/my-orders/[orderId]",
        params: { orderId },
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to place this order right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!draft) {
    return (
      <Screen>
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Review order</Text>
            <Text style={styles.muted}>
              No order draft is ready for review. Start a new order to continue.
            </Text>
            <AppButton
              label="Start new order"
              onPress={() => router.replace("/(customer)/new-order")}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Review & payment</Text>
          <Text style={styles.body}>
            Confirm the request and authorize demo payment before sending it to
            the laundromat.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Service</Text>
          <Text style={styles.value}>{serviceNames || "Service not found"}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schedule</Text>
          <Text style={styles.value}>
            Pickup: {formatDisplayDate(draft.input.scheduledPickupDate)} ·{" "}
            {draft.input.scheduledPickupWindow}
          </Text>
          <Text style={styles.value}>
            Drop-off: {formatDisplayDate(draft.input.scheduledDropoffDate)} ·{" "}
            {draft.input.scheduledDropoffWindow}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer address</Text>
          <Text style={styles.value}>
            {draft.input.address.street1}
            {draft.input.address.street2 ? ` ${draft.input.address.street2}` : ""},{" "}
            {draft.input.address.city}, {draft.input.address.state}{" "}
            {draft.input.address.postalCode}
          </Text>
          {draft.input.address.deliveryInstructions ? (
            <Text style={styles.muted}>
              {draft.input.address.deliveryInstructions}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Estimate</Text>
          <Text style={styles.value}>
            Laundry: {billableLaundryWeight.toFixed(1)} billable lb x $
            {draft.input.laundryPricePerPound.toFixed(2)}/lb = ${laundryEstimate.toFixed(2)}
          </Text>
          {draft.input.estimatedWeightPounds < draft.input.deliveryMinimumPounds ? (
            <Text style={styles.muted}>
              Customer estimate is {draft.input.estimatedWeightPounds.toFixed(1)} lb;
              the {draft.input.deliveryMinimumPounds} lb delivery minimum applies.
            </Text>
          ) : null}
          <Text style={styles.value}>Dry cleaning: ${dryCleaningSubtotal.toFixed(2)}</Text>
          {draft.input.selectedDryCleaningItems.map((item) => (
            <Text key={item.id} style={styles.muted}>
              {(item.quantity ?? 1) > 1 ? `${item.quantity} x ` : ""}
              {item.name} · ${item.price.toFixed(2)}
            </Text>
          ))}
          <Text style={styles.value}>Add-ons: ${addOnsSubtotal.toFixed(2)}</Text>
          {draft.input.selectedAddOns.map((addOn) => (
            <Text key={addOn.id} style={styles.muted}>
              {(addOn.quantity ?? 1) > 1 ? `${addOn.quantity} x ` : ""}
              {addOn.name} ·{" "}
              {addOn.price === null ? "Owner confirms" : `$${addOn.price.toFixed(2)}`}
            </Text>
          ))}
          <Text style={styles.value}>Gratuity: ${gratuityAmount.toFixed(2)}</Text>
          <Text style={styles.total}>Estimated total: ${estimatedTotal.toFixed(2)}</Text>
          <Text style={styles.muted}>
            Final invoice may change after the owner confirms actual weight and
            garment handling.
          </Text>
        </View>

        <View style={styles.rewardsCard}>
          <Text style={styles.cardTitle}>Potential rewards</Text>
          <Text style={styles.value}>
            {rewardSettings?.enabled
              ? `${potentialRewardPoints} point${
                  potentialRewardPoints === 1 ? "" : "s"
                } estimated`
              : "Rewards are currently paused"}
          </Text>
          <Text style={styles.muted}>
            {rewardSettings?.enabled
              ? `Rewards are estimated from this order total at ${rewardSettings.pointsPerDollar} point(s) per $1. Actual points are awarded after the order is paid and completed.`
              : "The business can turn customer rewards back on from rewards management."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment</Text>
          <Text style={styles.muted}>
            No real payment data is collected in this demo. Production will use
            Stripe PaymentSheet through the existing payment service so card
            details are entered only inside Stripe's secure UI.
          </Text>
          <View style={styles.paymentStatus}>
            <Text style={styles.value}>
              Status: {demoPaymentAuthorized ? "Demo authorized" : "Not authorized"}
            </Text>
            {demoPaymentReference ? (
              <Text style={styles.muted}>Reference: {demoPaymentReference}</Text>
            ) : null}
          </View>
          <AppButton
            disabled={isAuthorizingPayment || demoPaymentAuthorized}
            label={
              demoPaymentAuthorized
                ? "Demo payment authorized"
                : isAuthorizingPayment
                  ? "Authorizing..."
                  : "Authorize demo payment"
            }
            onPress={handleAuthorizeDemoPayment}
            variant={demoPaymentAuthorized ? "secondary" : "primary"}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isSubmitting ? <ActivityIndicator color={colors.primary} /> : null}

        <AppButton
          disabled={isSubmitting || !demoPaymentAuthorized}
          label={isSubmitting ? "Placing order..." : "Place order request"}
          onPress={handlePlaceOrder}
        />
        <AppButton
          disabled={isSubmitting}
          label="Edit order"
          onPress={() => router.back()}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  rewardsCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
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
    fontSize: 14,
    lineHeight: 20,
  },
  total: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  paymentStatus: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
