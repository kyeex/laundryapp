import { httpsCallable } from "firebase/functions";

import { getFirebaseFunctions } from "@/config/firebase";
import type { PaymentSheetSetup } from "@/types/domain";

type CreatePaymentIntentRequest = {
  orderId: string;
};

type CreatePaymentIntentResponse = PaymentSheetSetup;

export async function createOrderPaymentIntent(orderId: string) {
  const createPaymentIntent = httpsCallable<
    CreatePaymentIntentRequest,
    CreatePaymentIntentResponse
  >(getFirebaseFunctions(), "createPaymentIntent");

  const response = await createPaymentIntent({ orderId });

  return response.data;
}
