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
  const [paymentStep, setPaymentStep] = useState("");
  const [savedCard, setSavedCard] = useState<SavedStripePaymentMethod | null>(
    savedPaymentMethod,
  );

  useEffect(() => {
    setSavedCard(savedPaymentMethod);
  }, [savedPaymentMethod]);

  async function handleAuthorizeCard() {
    setError("");
    setPaymentStep("Preparing secure Stripe screen...");
    setIsAuthorizing(true);

    try {
      if (!isStripeConfigured) {
        throw new Error(
          "Stripe publishable key is missing from this mobile build. Rebuild the APK after updating EAS preview env.",
        );
      }

      const setup = await createOrderReviewSetupIntent(estimatedTotal);
      setPaymentStep("Opening encrypted card entry...");
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

      setPaymentStep("Waiting for card authorization...");
      const paymentSheetResult = await presentPaymentSheet();

      if (paymentSheetResult.error) {
        throw new Error(paymentSheetResult.error.message);
      }

      setPaymentStep("Saving card reference...");
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
      setPaymentStep("");
      setIsAuthorizing(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.heroPanel}>
        <View style={styles.heroIcon}>
          <Text style={styles.heroIconText}>$</Text>
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>Secure payment method</Text>
            <View style={styles.testBadge}>
              <Text style={styles.testBadgeText}>Test mode</Text>
            </View>
          </View>
          <Text style={styles.cardTitle}>
            {title ??
              (mode === "profile" ? "Save a default card" : "Add a card for this order")}
          </Text>
          <Text style={styles.heroText}>
            Stripe opens its own secure screen for card entry. LaundryApp stores
            only card summary details and Stripe references.
          </Text>
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
          <Text style={styles.securePillText}>No raw card storage</Text>
        </View>
        <View style={styles.securePill}>
          <Text style={styles.securePillText}>Encrypted entry</Text>
        </View>
      </View>

      <View style={styles.sheetPreview}>
        <View style={styles.sheetPreviewHeader}>
          <Text style={styles.fieldLabel}>Card details</Text>
          <Text style={styles.sheetPreviewStatus}>Opens in Stripe</Text>
        </View>
        <Text style={styles.muted}>
          Tap below to open the native card screen. In staging, use test card
          4242 4242 4242 4242.
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
        <Text style={styles.statusLabel}>
          {savedCard ? "Default card ready" : "Card status"}
        </Text>
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
      {isAuthorizing ? (
        <View style={styles.progressRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.progressText}>{paymentStep || "Opening Stripe..."}</Text>
        </View>
      ) : null}
      <AppButton
        disabled={disabled || isAuthorizing || !isStripeConfigured}
        label={
          savedCard
            ? "Update card securely"
            : isAuthorizing
              ? "Opening Stripe..."
              : "Open secure Stripe screen"
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
    gap: spacing.sm,
    padding: spacing.md,
  },
  heroPanel: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  heroIconText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  kickerRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 25,
  },
  heroText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  testBadge: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  testBadgeText: {
    color: "#92400E",
    fontSize: 10,
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
    padding: spacing.sm,
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
    fontSize: 21,
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
    padding: spacing.sm,
  },
  sheetPreviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  sheetPreviewStatus: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
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
    padding: spacing.sm,
  },
  savedStatusBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
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
  progressRow: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  progressText: {
    color: colors.primary,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
});
