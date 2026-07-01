import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import {
  confirmOrderReviewSetupIntent,
  createOrderReviewSetupIntent,
} from "@/services/paymentService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { SavedStripePaymentMethod } from "@/types/domain";

type StripePaymentMethodPanelProps = {
  customerEmail: string;
  customerName: string;
  disabled?: boolean;
  estimatedTotal: number;
  onSaved: (paymentMethod: SavedStripePaymentMethod) => void;
};

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isStripeConfigured =
  stripePublishableKey.startsWith("pk_test_") ||
  stripePublishableKey.startsWith("pk_live_");

export function StripePaymentMethodPanel({
  customerEmail,
  customerName,
  disabled = false,
  estimatedTotal,
  onSaved,
}: StripePaymentMethodPanelProps) {
  const [error, setError] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [savedCard, setSavedCard] = useState<SavedStripePaymentMethod | null>(null);

  async function handleAuthorizeCard() {
    setError("");
    setIsAuthorizing(true);

    try {
      if (!isStripeConfigured) {
        throw new Error(
          "Stripe publishable key is missing from this mobile build. Rebuild the APK after updating EAS preview env.",
        );
      }

      const setup = await createOrderReviewSetupIntent(estimatedTotal);
      const initResult = await initPaymentSheet({
        merchantDisplayName: "LaundryApp",
        setupIntentClientSecret: setup.setupIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: {
          email: customerEmail,
          name: customerName,
        },
      });

      if (initResult.error) {
        throw new Error(initResult.error.message);
      }

      const paymentSheetResult = await presentPaymentSheet();

      if (paymentSheetResult.error) {
        throw new Error(paymentSheetResult.error.message);
      }

      const paymentMethod = await confirmOrderReviewSetupIntent(setup.setupIntentId);
      setSavedCard(paymentMethod);
      onSaved(paymentMethod);
    } catch (authorizationError) {
      const message =
        authorizationError instanceof Error
          ? authorizationError.message
          : "Unable to authorize card.";
      setError(
        message.toLowerCase().includes("cancel")
          ? "Card authorization was canceled. No charge was completed."
          : message,
      );
    } finally {
      setIsAuthorizing(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Secure card authorization</Text>
      <Text style={styles.muted}>
        Add a card with Stripe now. The card is saved securely by Stripe and is
        charged later only after the owner confirms the final laundry price.
      </Text>
      <View style={styles.statusBox}>
        <Text style={styles.value}>
          {savedCard
            ? `${savedCard.brand.toUpperCase()} ending in ${savedCard.last4}`
            : "No card authorized yet"}
        </Text>
        <Text style={styles.muted}>
          {savedCard
            ? `Expires ${savedCard.expirationMonth}/${savedCard.expirationYear}`
            : "Stripe PaymentSheet opens when you tap the button below."}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isAuthorizing ? <ActivityIndicator color={colors.primary} /> : null}
      <AppButton
        disabled={disabled || isAuthorizing || !isStripeConfigured}
        label={
          savedCard
            ? "Update card with Stripe"
            : isAuthorizing
              ? "Opening Stripe..."
              : "Add card with Stripe"
        }
        onPress={handleAuthorizeCard}
      />
      {!isStripeConfigured ? (
        <Text style={styles.error}>
          Stripe is not configured in this mobile build.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 14,
    lineHeight: 20,
  },
  value: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  statusBox: {
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
