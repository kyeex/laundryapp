import {
  initPaymentSheet,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";

import type { PaymentSheetSetup } from "@/types/domain";

const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
const isStripeMobileCheckoutConfigured =
  stripePublishableKey.startsWith("pk_test_") ||
  stripePublishableKey.startsWith("pk_live_");

export async function initializeAndPresentPaymentSheet(setup: PaymentSheetSetup) {
  if (!isStripeMobileCheckoutConfigured) {
    throw new Error(
      "Native Stripe checkout is not configured in this mobile build. Add the Stripe publishable key and rebuild the APK.",
    );
  }

  if (!setup.paymentIntentClientSecret) {
    throw new Error("Stripe did not return a PaymentIntent client secret.");
  }

  const initResult = await initPaymentSheet({
    merchantDisplayName: "LaundryApp",
    paymentIntentClientSecret: setup.paymentIntentClientSecret,
    customerId: setup.customerId,
    customerEphemeralKeySecret: setup.customerEphemeralKeySecret,
    allowsDelayedPaymentMethods: false,
  });

  if (initResult.error) {
    throw new Error(initResult.error.message);
  }

  const paymentResult = await presentPaymentSheet();

  if (paymentResult.error) {
    throw new Error(paymentResult.error.message);
  }
}
