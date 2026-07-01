import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";
import { useEffect, useState } from "react";
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
  footerNote?: string;
  mode?: "order" | "profile";
  onSaved: (paymentMethod: SavedStripePaymentMethod) => void;
  savedPaymentMethod?: SavedStripePaymentMethod | null;
  subtitle?: string;
  summaryLabel?: string;
  title?: string;
};

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isStripeConfigured =
  stripePublishableKey.startsWith("pk_test_") ||
  stripePublishableKey.startsWith("pk_live_");

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

export function StripePaymentMethodPanel({
  customerEmail,
  customerName,
  disabled = false,
  estimatedTotal,
  footerNote,
  mode = "order",
  onSaved,
  savedPaymentMethod = null,
  subtitle,
  summaryLabel,
  title,
}: StripePaymentMethodPanelProps) {
  const [error, setError] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [savedCard, setSavedCard] = useState<SavedStripePaymentMethod | null>(
    savedPaymentMethod,
  );

  useEffect(() => {
    setSavedCard(savedPaymentMethod);
  }, [savedPaymentMethod]);

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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Secure payment method</Text>
          <Text style={styles.cardTitle}>
            {title ?? (mode === "profile" ? "Save a default card" : "Add a card for this order")}
          </Text>
        </View>
        <View style={styles.testBadge}>
          <Text style={styles.testBadgeText}>Test mode</Text>
        </View>
      </View>

      <View style={styles.summaryPanel}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>
            {summaryLabel ?? (mode === "profile" ? "Default payment method" : "Estimated order")}
          </Text>
          <Text style={styles.summaryValue}>{formatCurrency(estimatedTotal)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <Text style={styles.muted}>
          {subtitle ??
            (mode === "profile"
              ? "Save a default card with Stripe so future laundry orders can move through checkout faster."
              : "Your card is authorized and saved securely with Stripe. The laundromat charges the final confirmed price after the order is reviewed.")}
        </Text>
      </View>

      <View style={styles.secureRow}>
        <View style={styles.securePill}>
          <Text style={styles.securePillText}>Stripe PaymentSheet</Text>
        </View>
        <View style={styles.securePill}>
          <Text style={styles.securePillText}>No card data stored here</Text>
        </View>
      </View>

      <View style={styles.sheetPreview}>
        <Text style={styles.fieldLabel}>Card details</Text>
        <Text style={styles.muted}>
          Tap the button below to open Stripe's secure card entry screen.
        </Text>
        <View style={styles.brandRow}>
          {["Visa", "Mastercard", "Amex", "Discover"].map((brand) => (
            <View key={brand} style={styles.brandPill}>
              <Text style={styles.brandText}>{brand}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={savedCard ? styles.savedStatusBox : styles.statusBox}>
        <Text style={styles.value}>
          {savedCard
            ? `${savedCard.brand.toUpperCase()} ending in ${savedCard.last4}`
            : "Card authorization required"}
        </Text>
        <Text style={styles.muted}>
          {savedCard
            ? `Saved for final invoice. Expires ${savedCard.expirationMonth}/${savedCard.expirationYear}.`
            : "Use Stripe test card 4242 4242 4242 4242 while in staging."}
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
              : "Save card securely"
        }
        onPress={handleAuthorizeCard}
      />
      {!isStripeConfigured ? (
        <Text style={styles.error}>
          Stripe is not configured in this mobile build.
        </Text>
      ) : null}
      <Text style={styles.footerNote}>
        {footerNote ??
          "You will not be charged at order submission. Final payment happens after the owner confirms the actual price."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  headerRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  testBadge: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  testBadgeText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
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
  summaryPanel: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  summaryDivider: {
    backgroundColor: colors.border,
    height: 1,
  },
  secureRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  securePill: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  securePillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  sheetPreview: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  brandRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  brandPill: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  brandText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  savedStatusBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
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
  footerNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
