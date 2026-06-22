import type { PaymentSheetSetup } from "@/types/domain";

export async function initializeAndPresentPaymentSheet(_setup: PaymentSheetSetup) {
  throw new Error("Stripe PaymentSheet is only available in the native mobile app.");
}
