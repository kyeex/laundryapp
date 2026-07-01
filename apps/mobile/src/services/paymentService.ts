import { httpsCallable } from "firebase/functions";

import { getFirebaseFunctions } from "@/config/firebase";
import type {
  PaymentMethodSetup,
  PaymentSheetSetup,
  SavedStripePaymentMethod,
} from "@/types/domain";

type CreatePaymentIntentRequest = {
  orderId: string;
  rewardCreditDollars?: number;
};

type CreatePaymentIntentResponse = PaymentSheetSetup;
type ConfirmPaymentResponse = {
  status: "paid";
};
type CreateSetupIntentResponse = PaymentMethodSetup;
type ConfirmSetupIntentRequest = {
  setupIntentId: string;
};
type ChargeSavedPaymentResponse = {
  status: "paid" | "pending";
};

export async function createOrderPaymentIntent(
  orderId: string,
  rewardCreditDollars = 0,
) {
  const createPaymentIntent = httpsCallable<
    CreatePaymentIntentRequest,
    CreatePaymentIntentResponse
  >(getFirebaseFunctions(), "createPaymentIntent");

  const response = await createPaymentIntent({ orderId, rewardCreditDollars });

  return response.data;
}

export async function confirmOrderPayment(orderId: string) {
  const confirmPayment = httpsCallable<
    CreatePaymentIntentRequest,
    ConfirmPaymentResponse
  >(getFirebaseFunctions(), "confirmOrderPayment");

  const response = await confirmPayment({ orderId });

  return response.data;
}

export async function createOrderReviewSetupIntent(estimatedTotal: number) {
  const createSetupIntent = httpsCallable<
    { estimatedTotal?: number },
    CreateSetupIntentResponse
  >(getFirebaseFunctions(), "createOrderReviewSetupIntent");

  const response = await createSetupIntent({ estimatedTotal });

  return response.data;
}

export async function confirmOrderReviewSetupIntent(setupIntentId: string) {
  const confirmSetupIntent = httpsCallable<
    ConfirmSetupIntentRequest,
    SavedStripePaymentMethod
  >(getFirebaseFunctions(), "confirmOrderReviewSetupIntent");

  const response = await confirmSetupIntent({ setupIntentId });

  return response.data;
}

export async function chargeSavedOrderPayment(orderId: string) {
  const chargePayment = httpsCallable<
    { orderId: string },
    ChargeSavedPaymentResponse
  >(getFirebaseFunctions(), "chargeOrderSavedPaymentMethod");

  const response = await chargePayment({ orderId });

  return response.data;
}
