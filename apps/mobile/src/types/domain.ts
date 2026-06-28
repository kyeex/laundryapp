export type UserRole = "customer" | "owner" | "driver" | "admin";

export type OrderStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "pickup_assigned"
  | "picked_up"
  | "received_at_store"
  | "in_progress"
  | "priced"
  | "payment_requested"
  | "paid"
  | "ready_for_delivery"
  | "delivery_assigned"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "failed_pickup"
  | "failed_delivery";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded";

export type BatchType = "pickup" | "delivery" | "pickup_delivery";

export type BatchStatus =
  | "draft"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Service = {
  id: string;
  name: string;
  description: string;
  basePrice: number | null;
  active: boolean;
  sortOrder: number;
};

export type AddOnCategory = "washers" | "detergent" | "drying" | "extras";

export type AddOn = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  active: boolean;
  requiresOwnerConfirmation: boolean;
  sortOrder: number;
  category?: AddOnCategory;
  quantity?: number;
};

export type DryCleaningItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  active: boolean;
  sortOrder: number;
  quantity?: number;
};

export type PickupWindow = {
  id: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export type PickupAvailability = {
  availableWeekdays: number[];
  unavailableDates: string[];
};

export type LoyaltyRewardTier = {
  id: string;
  name: string;
  description: string;
  minimumPoints: number;
  color: string;
  active: boolean;
  sortOrder: number;
};

export type LoyaltyRewardSettings = {
  enabled: boolean;
  pointsPerDollar: number;
  pointsPerRewardDollar: number;
  signupBonusPoints: number;
  tiers: LoyaltyRewardTier[];
  tierThresholds: {
    freshStart: number;
    foldFavorite: number;
    laundryLoyalist: number;
  };
  expirationMonths: number | null;
};

export type NotificationPreferences = {
  customerOrderUpdates: boolean;
  ownerNewRequests: boolean;
  ownerPaymentUpdates: boolean;
  driverAssignedRoutes: boolean;
  rewardsUpdates: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  customerOrderUpdates: true,
  ownerNewRequests: true,
  ownerPaymentUpdates: true,
  driverAssignedRoutes: true,
  rewardsUpdates: true,
};

export type BusinessSettings = {
  businessName: string;
  phone: string;
  serviceAreaNotes: string;
  laundryPricePerPound: number;
  deliveryMinimumPounds: number;
  gratuityRateOptions: number[];
  loyaltyRewards: LoyaltyRewardSettings;
  pickupAvailability: PickupAvailability;
};

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  phone: string;
  active: boolean;
  expoPushTokens?: string[];
  notificationPreferences?: NotificationPreferences;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CustomerProfile = {
  userId: string;
  defaultAddressId: string | null;
  notes: string;
};

export type DriverProfile = {
  userId: string;
  active: boolean;
  phone: string;
  vehicleInfo: string;
};

export type Address = {
  id: string;
  userId: string;
  label: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  deliveryInstructions: string;
};

export type AddressInput = Omit<Address, "id" | "userId">;

export type Order = {
  id: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressId: string;
  addressSnapshot: AddressInput;
  selectedServiceIds: string[];
  selectedAddOns: AddOn[];
  selectedDryCleaningItems: DryCleaningItem[];
  laundryPricePerPound: number;
  deliveryMinimumPounds: number;
  estimatedWeightPounds: number | null;
  scheduledPickupDate: string;
  scheduledPickupWindow: string;
  scheduledDropoffDate: string;
  scheduledDropoffWindow: string;
  status: OrderStatus;
  customerNotes: string;
  ownerNotes: string;
  driverNotes: string;
  gratuityAmount: number;
  estimatedSubtotal: number;
  paymentStatus: PaymentStatus;
  finalPrice: number | null;
  rewardCreditAmount?: number;
  rewardPointsRedeemed?: number;
  rewardRedemptionId?: string | null;
  pickupBatchId?: string | null;
  deliveryBatchId?: string | null;
  assignedPickupDriverId?: string | null;
  assignedDeliveryDriverId?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateOrderInput = {
  address: AddressInput;
  selectedServiceIds: string[];
  selectedAddOns: AddOn[];
  selectedDryCleaningItems: DryCleaningItem[];
  laundryPricePerPound: number;
  deliveryMinimumPounds: number;
  estimatedWeightPounds: number;
  scheduledPickupDate: string;
  scheduledPickupWindow: string;
  scheduledDropoffDate: string;
  scheduledDropoffWindow: string;
  gratuityAmount: number;
  customerNotes: string;
};

export type Batch = {
  id: string;
  type: BatchType;
  status: BatchStatus;
  driverId: string;
  driverName: string;
  orderIds: string[];
  scheduledDate: string;
  notes: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateBatchInput = {
  type: BatchType;
  driverId: string;
  driverName: string;
  orderIds: string[];
  scheduledDate: string;
  notes: string;
  ownerId: string;
};

export type PaymentSheetSetup = {
  paymentIntentClientSecret: string;
  customerId?: string;
  customerEphemeralKeySecret?: string;
  publishableKey?: string;
};
