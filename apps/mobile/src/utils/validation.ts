import type {
  AddressInput,
  AddOn,
  BusinessSettings,
  CreateBatchInput,
  CreateOrderInput,
  PickupWindow,
  Service,
} from "@/types/domain";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const statePattern = /^[A-Za-z]{2}$/;
const zipPattern = /^\d{5}(-\d{4})?$/;

export function requireText(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

export function validateMoney(value: number | null, label: string) {
  if (value === null) {
    return;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a valid positive amount.`);
  }
}

export function validatePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

export function validateAddress(address: AddressInput) {
  requireText(address.street1, "Street address");
  requireText(address.city, "City");

  if (!statePattern.test(address.state.trim())) {
    throw new Error("State must use a two-letter abbreviation.");
  }

  if (!zipPattern.test(address.postalCode.trim())) {
    throw new Error("ZIP code must be valid.");
  }
}

export function validatePickupDate(value: string) {
  if (!isoDatePattern.test(value.trim())) {
    throw new Error("Pickup date must use YYYY-MM-DD format.");
  }
}

export function validateCreateOrderInput(input: CreateOrderInput) {
  validateAddress(input.address);
  validatePickupDate(input.scheduledPickupDate);
  validatePickupDate(input.scheduledDropoffDate);
  requireText(input.scheduledPickupWindow, "Pickup window");
  requireText(input.scheduledDropoffWindow, "Drop-off window");

  if (input.selectedServiceIds.length === 0) {
    throw new Error("Select a laundry service.");
  }

  validatePositiveNumber(input.estimatedWeightPounds, "Estimated laundry weight");
  validateMoney(input.gratuityAmount, "Gratuity");

  if (input.scheduledDropoffDate <= input.scheduledPickupDate) {
    throw new Error("Drop-off date must be after the pickup date.");
  }
}

export function validateCreateBatchInput(input: CreateBatchInput) {
  requireText(input.driverId, "Driver");
  requireText(input.driverName, "Driver name");
  validatePickupDate(input.scheduledDate);

  if (input.orderIds.length === 0) {
    throw new Error("Select at least one order for the batch.");
  }
}

export function validateService(service: Service) {
  requireText(service.name, "Service name");
  requireText(service.description, "Service description");
  validateMoney(service.basePrice, "Service base price");
}

export function validateAddOn(addOn: AddOn) {
  requireText(addOn.name, "Add-on name");
  requireText(addOn.description, "Add-on description");
  validateMoney(addOn.price, "Add-on price");
}

export function validatePickupWindow(pickupWindow: PickupWindow) {
  requireText(pickupWindow.label, "Pickup window");
}

export function validateBusinessSettings(settings: BusinessSettings) {
  requireText(settings.businessName, "Business name");
  validatePositiveNumber(settings.laundryPricePerPound, "Laundry price per pound");
  validatePositiveNumber(settings.deliveryMinimumPounds, "Delivery minimum pounds");

  settings.gratuityRateOptions.forEach((rate) => {
    if (!Number.isFinite(rate) || rate < 0) {
      throw new Error("Gratuity rates must be valid positive percentages.");
    }
  });

  if (settings.pickupAvailability.availableWeekdays.length === 0) {
    throw new Error("Select at least one available pickup weekday.");
  }
}
