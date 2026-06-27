import { demoBatches, demoOrders, demoUsers } from "@/data/demoData";
import { calculateLaundryEstimate } from "@/data/pricing";
import type {
  AppUser,
  Batch,
  BatchType,
  CreateBatchInput,
  CreateOrderInput,
  Order,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";
import {
  getAssignmentStatus,
  getOrderBatchType,
} from "@/workflows/orderWorkflow";

const demoOrdersStorageKey = "laundryapp.demo.orders.v3";
const demoBatchesStorageKey = "laundryapp.demo.batches.v2";

let inMemoryOrders: Order[] | null = null;
let inMemoryBatches: Batch[] | null = null;

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function hydrateOrder(order: Order): Order {
  return {
    ...order,
    customerEmail: order.customerEmail ?? "",
    estimatedWeightPounds: order.estimatedWeightPounds ?? null,
    selectedDryCleaningItems: order.selectedDryCleaningItems ?? [],
    laundryPricePerPound: order.laundryPricePerPound ?? 2,
    deliveryMinimumPounds: order.deliveryMinimumPounds ?? 20,
    gratuityAmount: order.gratuityAmount ?? 0,
    scheduledDropoffDate: order.scheduledDropoffDate ?? "",
    scheduledDropoffWindow: order.scheduledDropoffWindow ?? "",
    createdAt: order.createdAt ? new Date(order.createdAt) : null,
    updatedAt: order.updatedAt ? new Date(order.updatedAt) : null,
  };
}

function hydrateBatch(batch: Batch): Batch {
  return {
    ...batch,
    createdAt: batch.createdAt ? new Date(batch.createdAt) : null,
    updatedAt: batch.updatedAt ? new Date(batch.updatedAt) : null,
  };
}

function loadOrders() {
  if (inMemoryOrders) {
    return inMemoryOrders;
  }

  const storage = getStorage();
  const storedOrders = storage?.getItem(demoOrdersStorageKey);

  if (storedOrders) {
    try {
      const parsedOrders = JSON.parse(storedOrders) as Order[];
      inMemoryOrders = parsedOrders.map(hydrateOrder);
      return inMemoryOrders;
    } catch {
      storage?.removeItem(demoOrdersStorageKey);
    }
  }

  inMemoryOrders = demoOrders.map((order) => ({ ...order }));
  return inMemoryOrders;
}

function loadBatches() {
  if (inMemoryBatches) {
    return inMemoryBatches;
  }

  const storage = getStorage();
  const storedBatches = storage?.getItem(demoBatchesStorageKey);

  if (storedBatches) {
    try {
      const parsedBatches = JSON.parse(storedBatches) as Batch[];
      inMemoryBatches = parsedBatches.map(hydrateBatch);
      return inMemoryBatches;
    } catch {
      storage?.removeItem(demoBatchesStorageKey);
    }
  }

  inMemoryBatches = demoBatches.map((batch) => ({ ...batch }));
  return inMemoryBatches;
}

function saveOrders(orders: Order[]) {
  inMemoryOrders = orders;
  getStorage()?.setItem(demoOrdersStorageKey, JSON.stringify(orders));
}

function saveBatches(batches: Batch[]) {
  inMemoryBatches = batches;
  getStorage()?.setItem(demoBatchesStorageKey, JSON.stringify(batches));
}

export function resetDemoOrders() {
  inMemoryOrders = demoOrders.map((order) => ({ ...order }));
  inMemoryBatches = demoBatches.map((batch) => ({ ...batch }));
  getStorage()?.removeItem(demoOrdersStorageKey);
  getStorage()?.removeItem(demoBatchesStorageKey);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);

  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

export function seedFreshDemoOrders() {
  const now = new Date();
  const seedStamp = now.getTime();
  const sampleOrders: Order[] = [
    {
      id: `demo-seeded-request-${seedStamp}`,
      customerId: demoUsers.customer.id,
      customerName: demoUsers.customer.displayName,
      customerEmail: demoUsers.customer.email,
      customerPhone: demoUsers.customer.phone,
      addressId: `demo-seeded-address-${seedStamp}-1`,
      addressSnapshot: {
        label: "Home",
        street1: "54 Garden Street",
        street2: "Unit 2",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11222",
        deliveryInstructions: "Two blue bags by the entry table.",
      },
      selectedServiceIds: ["wash-fold"],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 12,
      selectedDryCleaningItems: [],
      selectedAddOns: [
        {
          id: "separate-colors",
          name: "Separate colors",
          description: "Separate colors from whites and lights.",
          price: 2.5,
          active: true,
          requiresOwnerConfirmation: false,
          sortOrder: 1,
          quantity: 1,
        },
      ],
      scheduledPickupDate: toIsoDate(addDays(now, 1)),
      scheduledPickupWindow: "9:00 AM - 12:00 PM",
      scheduledDropoffDate: toIsoDate(addDays(now, 3)),
      scheduledDropoffWindow: "12:00 PM - 3:00 PM",
      status: "requested",
      customerNotes: "Seeded demo request ready for owner accept or decline.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 6.38,
      estimatedSubtotal: 48.88,
      paymentStatus: "unpaid",
      finalPrice: null,
      pickupBatchId: null,
      deliveryBatchId: null,
      assignedPickupDriverId: null,
      assignedDeliveryDriverId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `demo-seeded-pickup-${seedStamp}`,
      customerId: "demo-seeded-customer-pickup",
      customerName: "Riley Morgan",
      customerEmail: "riley.morgan@example.com",
      customerPhone: "555-0441",
      addressId: `demo-seeded-address-${seedStamp}-2`,
      addressSnapshot: {
        label: "Apartment",
        street1: "209 Elm Court",
        street2: "Apt 7A",
        city: "Queens",
        state: "NY",
        postalCode: "11106",
        deliveryInstructions: "Call on arrival. Elevator is past the lobby desk.",
      },
      selectedServiceIds: ["wash-fold-dry-cleaning"],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 21,
      selectedDryCleaningItems: [
        {
          id: "button-down-long-sleeve",
          name: "Button down long sleeve",
          description: "Pressed long-sleeve button down shirt.",
          price: 5,
          active: true,
          sortOrder: 1,
          quantity: 3,
        },
      ],
      selectedAddOns: [],
      scheduledPickupDate: toIsoDate(addDays(now, 1)),
      scheduledPickupWindow: "12:00 PM - 3:00 PM",
      scheduledDropoffDate: toIsoDate(addDays(now, 4)),
      scheduledDropoffWindow: "3:00 PM - 6:00 PM",
      status: "accepted",
      customerNotes: "Seeded accepted order ready for pickup batching.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 8.55,
      estimatedSubtotal: 65.55,
      paymentStatus: "unpaid",
      finalPrice: null,
      pickupBatchId: null,
      deliveryBatchId: null,
      assignedPickupDriverId: null,
      assignedDeliveryDriverId: null,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
    {
      id: `demo-seeded-delivery-${seedStamp}`,
      customerId: "demo-seeded-customer-delivery",
      customerName: "Priya Shah",
      customerEmail: "priya.shah@example.com",
      customerPhone: "555-0442",
      addressId: `demo-seeded-address-${seedStamp}-3`,
      addressSnapshot: {
        label: "Condo",
        street1: "18 Harbor Walk",
        street2: "Floor 5",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11249",
        deliveryInstructions: "Leave with concierge if customer is unavailable.",
      },
      selectedServiceIds: ["wash-fold"],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 28,
      selectedDryCleaningItems: [],
      selectedAddOns: [
        {
          id: "comforter-king",
          name: "King comforter",
          description: "King-size comforter cleaning.",
          price: 15,
          active: true,
          requiresOwnerConfirmation: false,
          sortOrder: 3,
          quantity: 1,
        },
      ],
      scheduledPickupDate: toIsoDate(addDays(now, -1)),
      scheduledPickupWindow: "9:00 AM - 12:00 PM",
      scheduledDropoffDate: toIsoDate(addDays(now, 2)),
      scheduledDropoffWindow: "12:00 PM - 3:00 PM",
      status: "ready_for_delivery",
      customerNotes: "Seeded paid order ready for delivery batching.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 10.65,
      estimatedSubtotal: 81.65,
      paymentStatus: "paid",
      finalPrice: 81.65,
      pickupBatchId: null,
      deliveryBatchId: null,
      assignedPickupDriverId: null,
      assignedDeliveryDriverId: null,
      createdAt: addDays(now, -2),
      updatedAt: now,
    },
    {
      id: `demo-seeded-pricing-test-${seedStamp}`,
      customerId: "demo-seeded-customer-pricing",
      customerName: "Jamie Price",
      customerEmail: "jamie.price@example.com",
      customerPhone: "555-0443",
      addressId: `demo-seeded-address-${seedStamp}-4`,
      addressSnapshot: {
        label: "Townhome",
        street1: "64 Cedar Lane",
        street2: "",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11231",
        deliveryInstructions: "Pricing test order. Use this to test the $0.00 warning.",
      },
      selectedServiceIds: ["wash-fold"],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 22,
      selectedDryCleaningItems: [],
      selectedAddOns: [
        {
          id: "medium-washer",
          name: "Medium washer",
          description: "Medium washer load.",
          price: 5.75,
          active: true,
          requiresOwnerConfirmation: false,
          sortOrder: 2,
          quantity: 1,
        },
        {
          id: "tide-detergent",
          name: "Tide detergent",
          description: "Tide detergent selection.",
          price: 4,
          active: true,
          requiresOwnerConfirmation: false,
          sortOrder: 5,
          quantity: 1,
        },
      ],
      scheduledPickupDate: toIsoDate(addDays(now, -1)),
      scheduledPickupWindow: "12:00 PM - 3:00 PM",
      scheduledDropoffDate: toIsoDate(addDays(now, 2)),
      scheduledDropoffWindow: "3:00 PM - 6:00 PM",
      status: "in_progress",
      customerNotes: "Seeded pricing test order. Try saving final price as 0.00.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 8.06,
      estimatedSubtotal: 61.81,
      paymentStatus: "unpaid",
      finalPrice: null,
      pickupBatchId: null,
      deliveryBatchId: null,
      assignedPickupDriverId: null,
      assignedDeliveryDriverId: null,
      createdAt: addDays(now, -1),
      updatedAt: now,
    },
  ];
  const existingOrders = loadOrders().filter(
    (order) => !order.id.startsWith("demo-seeded-"),
  );

  saveOrders([...sampleOrders, ...existingOrders]);

  return sampleOrders.length;
}

function calculateEstimatedSubtotal(input: CreateOrderInput) {
  const laundryEstimate = calculateLaundryEstimate(input.estimatedWeightPounds, {
    deliveryMinimumPounds: input.deliveryMinimumPounds,
    laundryPricePerPound: input.laundryPricePerPound,
  });
  const addOnsEstimate = input.selectedAddOns.reduce(
    (total, addOn) => total + (addOn.price ?? 0) * (addOn.quantity ?? 1),
    0,
  );
  const dryCleaningEstimate = input.selectedDryCleaningItems.reduce(
    (total, item) => total + item.price * (item.quantity ?? 1),
    0,
  );

  return laundryEstimate + addOnsEstimate + dryCleaningEstimate + input.gratuityAmount;
}

function sortNewestFirst(orders: Order[]) {
  return [...orders].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;

    return bTime - aTime;
  });
}

export function getDemoOrders() {
  return sortNewestFirst(loadOrders());
}

export function getDemoBatches() {
  return [...loadBatches()].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;

    return bTime - aTime;
  });
}

export function getDemoBatchById(batchId: string) {
  return loadBatches().find((batch) => batch.id === batchId) ?? null;
}

export function getDemoOrderById(orderId: string) {
  return loadOrders().find((order) => order.id === orderId) ?? null;
}

export function createDemoCustomerOrder(customer: AppUser, input: CreateOrderInput) {
  const now = new Date();
  const normalizedAddress = {
    ...input.address,
    label: input.address.label.trim() || "Home",
    street1: input.address.street1.trim(),
    street2: input.address.street2.trim(),
    city: input.address.city.trim(),
    state: input.address.state.trim().toUpperCase(),
    postalCode: input.address.postalCode.trim(),
    deliveryInstructions: input.address.deliveryInstructions.trim(),
  };
  const orderId = `demo-order-${now.getTime()}`;
  const newOrder: Order = {
    id: orderId,
    customerId: customer.id,
    customerName: customer.displayName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    addressId: `demo-address-${now.getTime()}`,
    addressSnapshot: normalizedAddress,
    selectedServiceIds: input.selectedServiceIds,
    selectedAddOns: input.selectedAddOns,
    selectedDryCleaningItems: input.selectedDryCleaningItems,
    laundryPricePerPound: input.laundryPricePerPound,
    deliveryMinimumPounds: input.deliveryMinimumPounds,
    estimatedWeightPounds: input.estimatedWeightPounds,
    scheduledPickupDate: input.scheduledPickupDate.trim(),
    scheduledPickupWindow: input.scheduledPickupWindow.trim(),
    scheduledDropoffDate: input.scheduledDropoffDate.trim(),
    scheduledDropoffWindow: input.scheduledDropoffWindow.trim(),
    status: "requested",
    customerNotes: input.customerNotes.trim(),
    ownerNotes: "",
    driverNotes: "",
    gratuityAmount: input.gratuityAmount,
    estimatedSubtotal: calculateEstimatedSubtotal(input),
    paymentStatus: "unpaid",
    finalPrice: null,
    pickupBatchId: null,
    deliveryBatchId: null,
    assignedPickupDriverId: null,
    assignedDeliveryDriverId: null,
    createdAt: now,
    updatedAt: now,
  };

  saveOrders([newOrder, ...loadOrders()]);

  return orderId;
}

export function updateDemoOrderStatus(input: {
  orderId: string;
  toStatus: OrderStatus;
}) {
  const now = new Date();
  saveOrders(
    loadOrders().map((order) =>
      order.id === input.orderId
        ? {
            ...order,
            status: input.toStatus,
            updatedAt: now,
          }
        : order,
    ),
  );
}

export function setDemoOrderFinalPrice(input: {
  orderId: string;
  finalPrice: number;
}) {
  const now = new Date();
  const paymentStatus: PaymentStatus = "unpaid";
  saveOrders(
    loadOrders().map((order) =>
      order.id === input.orderId && order.paymentStatus === "paid"
        ? order
        : order.id === input.orderId
        ? {
            ...order,
            finalPrice: input.finalPrice,
            paymentStatus,
            status: "priced",
            updatedAt: now,
          }
        : order,
    ),
  );
}

export function markDemoOrderPaid(orderId: string) {
  const now = new Date();
  saveOrders(
    loadOrders().map((order) =>
      order.id === orderId
        ? {
            ...order,
            paymentStatus: "paid",
            status: "paid",
            updatedAt: now,
          }
        : order,
    ),
  );
}

export function createDemoBatch(input: CreateBatchInput) {
  const now = new Date();
  const batchId = `demo-batch-${input.type}-${now.getTime()}`;
  const batch: Batch = {
    id: batchId,
    type: input.type,
    status: "assigned",
    driverId: input.driverId,
    driverName: input.driverName,
    orderIds: input.orderIds,
    scheduledDate: input.scheduledDate.trim(),
    notes: input.notes.trim(),
    createdAt: now,
    updatedAt: now,
  };

  saveBatches([batch, ...loadBatches()]);
  saveOrders(
    loadOrders().map((order) => {
      if (!input.orderIds.includes(order.id)) {
        return order;
      }

      const assignmentType =
        input.type === "pickup_delivery" ? getOrderBatchType(order) : input.type;
      const status = getAssignmentStatus(assignmentType);

      return assignmentType === "pickup"
        ? {
            ...order,
            pickupBatchId: batchId,
            assignedPickupDriverId: input.driverId,
            status,
            updatedAt: now,
          }
        : {
            ...order,
            deliveryBatchId: batchId,
            assignedDeliveryDriverId: input.driverId,
            status,
            updatedAt: now,
          };
    }),
  );

  return batchId;
}

export function updateDemoBatchStatus(input: {
  batchId: string;
  status: Batch["status"];
}) {
  const now = new Date();

  saveBatches(
    loadBatches().map((batch) =>
      batch.id === input.batchId
        ? {
            ...batch,
            status: input.status,
            updatedAt: now,
          }
        : batch,
    ),
  );
}
