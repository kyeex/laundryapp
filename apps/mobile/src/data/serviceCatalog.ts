import type { AddOn, BusinessSettings, PickupWindow, Service } from "@/types/domain";

export const serviceCatalog: Service[] = [
  {
    id: "wash-fold",
    name: "Wash and fold",
    description: "Everyday laundry washed, dried, and folded.",
    basePrice: null,
    active: true,
    sortOrder: 1,
  },
  {
    id: "wash-fold-dry-cleaning",
    name: "Wash and fold + dry cleaning",
    description: "A combined order for laundry and dry-clean-only items.",
    basePrice: null,
    active: true,
    sortOrder: 2,
  },
];

export const serviceAddOns: AddOn[] = [
  {
    id: "separate-colors",
    name: "Separate colors",
    description: "Separate colors from whites and lights.",
    price: 2.5,
    active: true,
    requiresOwnerConfirmation: false,
    sortOrder: 1,
  },
  {
    id: "comforter",
    name: "Comforter",
    description: "Extra care for bulky bedding. Choose a size below.",
    price: null,
    active: true,
    requiresOwnerConfirmation: false,
    sortOrder: 2,
  },
  {
    id: "rush-service",
    name: "Rush service",
    description: "Request a faster turnaround when available.",
    price: null,
    active: true,
    requiresOwnerConfirmation: true,
    sortOrder: 3,
  },
];

export const comforterSizeAddOns: AddOn[] = [
  {
    id: "comforter-full",
    name: "Full comforter",
    description: "Full-size comforter cleaning.",
    price: 10,
    active: true,
    requiresOwnerConfirmation: false,
    sortOrder: 1,
  },
  {
    id: "comforter-queen",
    name: "Queen comforter",
    description: "Queen-size comforter cleaning.",
    price: 12,
    active: true,
    requiresOwnerConfirmation: false,
    sortOrder: 2,
  },
  {
    id: "comforter-king",
    name: "King comforter",
    description: "King-size comforter cleaning.",
    price: 15,
    active: true,
    requiresOwnerConfirmation: false,
    sortOrder: 3,
  },
];

export const defaultPickupWindows: PickupWindow[] = [
  { id: "9-12", label: "9:00 AM - 12:00 PM", active: true, sortOrder: 1 },
  { id: "12-3", label: "12:00 PM - 3:00 PM", active: true, sortOrder: 2 },
  { id: "3-6", label: "3:00 PM - 6:00 PM", active: true, sortOrder: 3 },
];

export const defaultBusinessSettings: BusinessSettings = {
  businessName: "LaundryApp",
  phone: "",
  serviceAreaNotes: "",
  laundryPricePerPound: 2,
  deliveryMinimumPounds: 20,
  gratuityRateOptions: [0.15, 0.2, 0.25],
  pickupAvailability: {
    availableWeekdays: [1, 2, 3, 4, 5, 6],
    unavailableDates: [],
  },
};
