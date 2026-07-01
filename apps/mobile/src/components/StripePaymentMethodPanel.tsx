import React, { useEffect, useMemo, useRef, useState } from "react";
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

type StripeCardElement = {
  mount: (selector: string) => void;
  destroy: () => void;
};

type StripeElements = {
  create: (type: "card", options?: Record<string, unknown>) => StripeCardElement;
};

type StripeJs = {
  elements: () => StripeElements;
  confirmCardSetup: (
    clientSecret: string,
    options: Record<string, unknown>,
  ) => Promise<{
    error?: { message?: string };
    setupIntent?: { id?: string; status?: string };
  }>;
};

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeJs;
  }
}

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isStripeConfigured =
  stripePublishableKey.startsWith("pk_test_") ||
  stripePublishableKey.startsWith("pk_live_");

let stripeScriptPromise: Promise<StripeJs> | null = null;

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function loadStripeJs() {
  if (!isStripeConfigured) {
    return Promise.reject(
      new Error("Stripe publishable key is missing from this web build."),
    );
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("Stripe card entry is available in the web and native mobile builds."),
    );
  }

  if (window.Stripe) {
    return Promise.resolve(window.Stripe(stripePublishableKey));
  }

  if (!stripeScriptPromise) {
    stripeScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://js.stripe.com/v3/";
      script.onload = () => {
        if (!window.Stripe) {
          reject(new Error("Stripe.js did not load."));
          return;
        }

        resolve(window.Stripe(stripePublishableKey));
      };
      script.onerror = () => reject(new Error("Unable to load Stripe.js."));
      document.head.appendChild(script);
    });
  }

  return stripeScriptPromise;
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
  const cardElementId = useMemo(
    () => `stripe-card-${Math.random().toString(36).slice(2)}`,
    [],
  );
  const stripeRef = useRef<StripeJs | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [error, setError] = useState("");
  const [isLoadingStripe, setIsLoadingStripe] = useState(true);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [savedCard, setSavedCard] = useState<SavedStripePaymentMethod | null>(
    savedPaymentMethod,
  );

  useEffect(() => {
    setSavedCard(savedPaymentMethod);
  }, [savedPaymentMethod]);

  useEffect(() => {
    let mounted = true;

    async function mountCardElement() {
      setError("");
      setIsLoadingStripe(true);

      try {
        const stripe = await loadStripeJs();
        const elements = stripe.elements();
        const card = elements.create("card", {
          hidePostalCode: false,
          style: {
            base: {
              color: "#0F172A",
              fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "16px",
              "::placeholder": {
                color: "#94A3B8",
              },
            },
            invalid: {
              color: "#DC2626",
            },
          },
        });

        if (!mounted) {
          card.destroy();
          return;
        }

        stripeRef.current = stripe;
        cardRef.current = card;
        card.mount(`#${cardElementId}`);
      } catch (mountError) {
        const message =
          mountError instanceof Error
            ? mountError.message
            : "Unable to load Stripe card entry.";
        setError(message);
      } finally {
        if (mounted) {
          setIsLoadingStripe(false);
        }
      }
    }

    void mountCardElement();

    return () => {
      mounted = false;
      cardRef.current?.destroy();
      cardRef.current = null;
    };
  }, [cardElementId]);

  async function handleAuthorizeCard() {
    setError("");
    setIsAuthorizing(true);

    try {
      if (!stripeRef.current || !cardRef.current) {
        throw new Error("Stripe card entry is not ready yet.");
      }

      const setup = await createOrderReviewSetupIntent(estimatedTotal);
      const confirmation = await stripeRef.current.confirmCardSetup(
        setup.setupIntentClientSecret,
        {
          payment_method: {
            card: cardRef.current,
            billing_details: {
              email: customerEmail,
              name: customerName,
            },
          },
        },
      );

      if (confirmation.error) {
        throw new Error(confirmation.error.message ?? "Stripe card setup failed.");
      }

      const paymentMethod = await confirmOrderReviewSetupIntent(setup.setupIntentId);
      setSavedCard(paymentMethod);
      onSaved(paymentMethod);
    } catch (authorizationError) {
      const message =
        authorizationError instanceof Error
          ? authorizationError.message
          : "Unable to authorize card.";
      setError(message);
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
          <Text style={styles.securePillText}>Encrypted by Stripe</Text>
        </View>
        <View style={styles.securePill}>
          <Text style={styles.securePillText}>No card data stored here</Text>
        </View>
      </View>

      <View style={styles.cardEntryPanel}>
        <Text style={styles.fieldLabel}>Card details</Text>
        <View style={styles.cardElementShell}>
          {React.createElement("div", {
            id: cardElementId,
            style: {
              minHeight: 32,
              paddingTop: 4,
            },
          })}
        </View>
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
      {isLoadingStripe || isAuthorizing ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
      <AppButton
        disabled={disabled || isLoadingStripe || isAuthorizing || !isStripeConfigured}
        label={
          savedCard
            ? "Update card with Stripe"
            : isAuthorizing
              ? "Authorizing..."
              : "Save card securely"
        }
        onPress={handleAuthorizeCard}
      />
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
  cardEntryPanel: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  cardElementShell: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
