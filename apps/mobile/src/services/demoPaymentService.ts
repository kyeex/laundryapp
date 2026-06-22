export type DemoPaymentAuthorization = {
  id: string;
  status: "demo_authorized";
  provider: "demo";
  authorizedAt: string;
};

export async function authorizeDemoOrderPayment(input: {
  estimatedTotal: number;
}) {
  if (!Number.isFinite(input.estimatedTotal) || input.estimatedTotal <= 0) {
    throw new Error("Order total must be greater than zero.");
  }

  return {
    id: `demo-payment-${Date.now()}`,
    status: "demo_authorized",
    provider: "demo",
    authorizedAt: new Date().toISOString(),
  } satisfies DemoPaymentAuthorization;
}
