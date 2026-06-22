export const laundryPricePerPound = 2;
export const deliveryMinimumPounds = 20;

type PricingOptions = {
  deliveryMinimumPounds?: number;
  laundryPricePerPound?: number;
};

export function calculateBillableLaundryWeight(
  weightPounds: number,
  options: PricingOptions = {},
) {
  if (!Number.isFinite(weightPounds) || weightPounds <= 0) {
    return 0;
  }

  return Math.max(weightPounds, options.deliveryMinimumPounds ?? deliveryMinimumPounds);
}

export function calculateLaundryEstimate(
  weightPounds: number,
  options: PricingOptions = {},
) {
  return (
    calculateBillableLaundryWeight(weightPounds, options) *
    (options.laundryPricePerPound ?? laundryPricePerPound)
  );
}
