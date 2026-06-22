import {
  initPaymentSheet,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";

import type { PaymentSheetSetup } from "@/types/domain";

export async function initializeAndPresentPaymentSheet(setup: PaymentSheetSetup) {
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
