import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { StripePaymentMethodPanel } from "@/components/StripePaymentMethodPanel";
import { useAuth } from "@/context/AuthContext";
import {
  getCustomerProfileSummary,
  type CustomerPaymentMethod,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { SavedStripePaymentMethod } from "@/types/domain";

const emptyPaymentMethod: CustomerPaymentMethod = {
  cardholderName: "",
  brand: "",
  last4: "",
  expirationMonth: "",
  expirationYear: "",
};

export default function CustomerPaymentMethodScreen() {
  const { currentUser } = useAuth();
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>(emptyPaymentMethod);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadPaymentMethod = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const profile = await getCustomerProfileSummary(currentUser.id);
      setPaymentMethod(profile.paymentMethod);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payment method right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadPaymentMethod();
  }, [loadPaymentMethod]);

  const hasSavedCard =
    paymentMethod.brand && paymentMethod.last4 && paymentMethod.expirationMonth;
  const savedStripePaymentMethod: SavedStripePaymentMethod | null =
    hasSavedCard && paymentMethod.stripeCustomerId && paymentMethod.stripePaymentMethodId
      ? {
          brand: paymentMethod.brand,
          expirationMonth: paymentMethod.expirationMonth,
          expirationYear: paymentMethod.expirationYear,
          last4: paymentMethod.last4,
          paymentMethodId: paymentMethod.stripePaymentMethodId,
          setupIntentId: paymentMethod.stripeSetupIntentId ?? "",
          stripeCustomerId: paymentMethod.stripeCustomerId,
        }
      : null;

  function handleStripePaymentMethodSaved(savedPaymentMethod: SavedStripePaymentMethod) {
    setPaymentMethod({
      brand: savedPaymentMethod.brand,
      cardholderName: currentUser?.displayName ?? "",
      expirationMonth: savedPaymentMethod.expirationMonth,
      expirationYear: savedPaymentMethod.expirationYear,
      last4: savedPaymentMethod.last4,
      stripeCustomerId: savedPaymentMethod.stripeCustomerId,
      stripePaymentMethodId: savedPaymentMethod.paymentMethodId,
      stripeSetupIntentId: savedPaymentMethod.setupIntentId,
    });
    setSuccess("Payment method saved securely with Stripe.");
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment method</Text>
          <Text style={styles.body}>
            Save a default Stripe payment method for future laundry orders. Card
            details are entered only through Stripe's secure UI.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading ? (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Text style={styles.summaryIconText}>{hasSavedCard ? "OK" : "--"}</Text>
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>Saved payment</Text>
                <Text style={styles.summaryValue}>
                  {hasSavedCard
                    ? `${paymentMethod.brand.toUpperCase()} ending in ${paymentMethod.last4}`
                    : "No default card saved"}
                </Text>
                <Text style={styles.summaryMeta}>
                  {hasSavedCard
                    ? `Expires ${paymentMethod.expirationMonth}/${paymentMethod.expirationYear || "YYYY"}`
                    : "Add a card once and use it to speed up future order review."}
                </Text>
              </View>
            </View>

            <StripePaymentMethodPanel
              customerEmail={currentUser?.email ?? ""}
              customerName={currentUser?.displayName ?? ""}
              estimatedTotal={0}
              footerNote="Saving a default card does not create a charge. You are charged only after an order has a confirmed final price."
              mode="profile"
              onSaved={handleStripePaymentMethodSaved}
              savedPaymentMethod={savedStripePaymentMethod}
              subtitle="Use Stripe to save a default card for future orders. LaundryApp stores only the card brand, last four digits, and Stripe references."
              summaryLabel="Default card"
              title="Manage default card"
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    paddingBottom: spacing.xl,
    paddingTop: Platform.select({
      default: spacing.sm,
      web: spacing.lg,
    }),
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: Platform.select({
      default: 28,
      web: 32,
    }),
    fontWeight: "800",
    lineHeight: Platform.select({
      default: 34,
      web: undefined,
    }),
  },
  body: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 15,
      web: 16,
    }),
    lineHeight: Platform.select({
      default: 22,
      web: 24,
    }),
  },
  summaryCard: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  summaryIcon: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  summaryIconText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
