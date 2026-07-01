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
  onSaved: (paymentMethod: SavedStripePaymentMethod) => void;
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

function loadStripeJs() {
  if (!isStripeConfigured) {
    return Promise.reject(
      new Error("Stripe publishable key is missing from this web build."),
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
  onSaved,
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
  const [savedCard, setSavedCard] = useState<SavedStripePaymentMethod | null>(null);

  useEffect(() => {
    let mounted = true;

    async function mountCardElement() {
      setError("");
      setIsLoadingStripe(true);

      try {
        const stripe = await loadStripeJs();
        const elements = stripe.elements();
        const card = elements.create("card", {
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
      <Text style={styles.cardTitle}>Secure card authorization</Text>
      <Text style={styles.muted}>
        Add a card with Stripe now. The card is saved securely by Stripe and is
        charged later only after the owner confirms the final laundry price.
      </Text>
      <View style={styles.cardElementShell}>
        {React.createElement("div", {
          id: cardElementId,
          style: {
            minHeight: 28,
            paddingTop: 4,
          },
        })}
      </View>
      <View style={styles.statusBox}>
        <Text style={styles.value}>
          {savedCard
            ? `${savedCard.brand.toUpperCase()} ending in ${savedCard.last4}`
            : "No card authorized yet"}
        </Text>
        <Text style={styles.muted}>
          {savedCard
            ? `Expires ${savedCard.expirationMonth}/${savedCard.expirationYear}`
            : "Use Stripe test card 4242 4242 4242 4242 in staging."}
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
              : "Authorize card with Stripe"
        }
        onPress={handleAuthorizeCard}
      />
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
  cardElementShell: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
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
