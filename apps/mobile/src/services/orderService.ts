import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import {
  createDemoCustomerOrder,
  getDemoOrderById,
  getDemoOrders,
  markDemoOrderPaid,
  setDemoOrderFinalPrice,
  updateDemoOrderStatus,
} from "@/data/demoStore";
import { calculateLaundryEstimate } from "@/data/pricing";
import type {
  AddressInput,
  AppUser,
  CreateOrderInput,
  Order,
  OrderStatus,
  PaymentStatus,
} from "@/types/domain";
import { validateCreateOrderInput, validateMoney } from "@/utils/validation";

import { recordAuditLog } from "./auditLogService";

function calculateEstimatedSubtotal(addOns: CreateOrderInput["selectedAddOns"]) {
  return addOns.reduce(
    (total, addOn) => total + (addOn.price ?? 0) * (addOn.quantity ?? 1),
    0,
  );
}

function calculateDryCleaningSubtotal(
  items: CreateOrderInput["selectedDryCleaningItems"],
) {
  return items.reduce(
    (total, item) => total + item.price * (item.quantity ?? 1),
    0,
  );
}

function calculateOrderEstimate(input: CreateOrderInput) {
  return (
    calculateLaundryEstimate(input.estimatedWeightPounds, {
      deliveryMinimumPounds: input.deliveryMinimumPounds,
      laundryPricePerPound: input.laundryPricePerPound,
    }) +
    calculateEstimatedSubtotal(input.selectedAddOns) +
    calculateDryCleaningSubtotal(input.selectedDryCleaningItems) +
    input.gratuityAmount
  );
}

export function mapOrder(id: string, data: DocumentData): Order {
  return {
    id,
    customerId: data.customerId ?? "",
    customerName: data.customerName ?? "",
    customerPhone: data.customerPhone ?? "",
    addressId: data.addressId ?? "",
    addressSnapshot: data.addressSnapshot ?? {
      label: "",
      street1: "",
      street2: "",
      city: "",
      state: "",
      postalCode: "",
      deliveryInstructions: "",
    },
    selectedServiceIds: data.selectedServiceIds ?? [],
    selectedAddOns: data.selectedAddOns ?? [],
    selectedDryCleaningItems: data.selectedDryCleaningItems ?? [],
    laundryPricePerPound: data.laundryPricePerPound ?? 2,
    deliveryMinimumPounds: data.deliveryMinimumPounds ?? 20,
    estimatedWeightPounds: data.estimatedWeightPounds ?? null,
    scheduledPickupDate: data.scheduledPickupDate ?? "",
    scheduledPickupWindow: data.scheduledPickupWindow ?? "",
    scheduledDropoffDate: data.scheduledDropoffDate ?? "",
    scheduledDropoffWindow: data.scheduledDropoffWindow ?? "",
    status: data.status ?? "requested",
    customerNotes: data.customerNotes ?? "",
    ownerNotes: data.ownerNotes ?? "",
    driverNotes: data.driverNotes ?? "",
    gratuityAmount: data.gratuityAmount ?? 0,
    estimatedSubtotal: data.estimatedSubtotal ?? 0,
    paymentStatus: data.paymentStatus ?? "unpaid",
    finalPrice: data.finalPrice ?? null,
    pickupBatchId: data.pickupBatchId ?? null,
    deliveryBatchId: data.deliveryBatchId ?? null,
    assignedPickupDriverId: data.assignedPickupDriverId ?? null,
    assignedDeliveryDriverId: data.assignedDeliveryDriverId ?? null,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

export async function createCustomerOrder(customer: AppUser, input: CreateOrderInput) {
  validateCreateOrderInput(input);

  if (shouldUseDemoBackend) {
    return createDemoCustomerOrder(customer, input);
  }

  const db = getFirebaseFirestore();

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

  const addressRef = await addDoc(collection(db, "addresses"), {
    ...normalizedAddress,
    userId: customer.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const estimatedSubtotal = calculateOrderEstimate(input);
  const orderRef = await addDoc(collection(db, "orders"), {
    customerId: customer.id,
    customerName: customer.displayName,
    customerPhone: customer.phone,
    addressId: addressRef.id,
    addressSnapshot: normalizedAddress,
    selectedServiceIds: input.selectedServiceIds,
    selectedAddOns: input.selectedAddOns,
    selectedDryCleaningItems: input.selectedDryCleaningItems,
    laundryPricePerPound: input.laundryPricePerPound,
    deliveryMinimumPounds: input.deliveryMinimumPounds,
    estimatedWeightPounds: input.estimatedWeightPounds,
    scheduledPickupDate: input.scheduledPickupDate,
    scheduledPickupWindow: input.scheduledPickupWindow.trim(),
    scheduledDropoffDate: input.scheduledDropoffDate,
    scheduledDropoffWindow: input.scheduledDropoffWindow.trim(),
    status: "requested",
    customerNotes: input.customerNotes.trim(),
    ownerNotes: "",
    driverNotes: "",
    gratuityAmount: input.gratuityAmount,
    estimatedSubtotal,
    finalPrice: null,
    paymentStatus: "unpaid",
    pickupBatchId: null,
    deliveryBatchId: null,
    assignedPickupDriverId: null,
    assignedDeliveryDriverId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, "orderEvents"), {
    orderId: orderRef.id,
    type: "order_created",
    fromStatus: null,
    toStatus: "requested",
    message: "Customer submitted a new order request.",
    createdBy: customer.id,
    createdAt: serverTimestamp(),
  });

  return orderRef.id;
}

export async function getCustomerOrders(customerId: string) {
  if (shouldUseDemoBackend) {
    return getDemoOrders().filter((order) => order.customerId === customerId);
  }

  const db = getFirebaseFirestore();
  const ordersQuery = query(
    collection(db, "orders"),
    where("customerId", "==", customerId),
  );
  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs
    .map((orderDoc) => mapOrder(orderDoc.id, orderDoc.data()))
    .sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;

      return bTime - aTime;
    });
}

export async function getCustomerOrderById(customerId: string, orderId: string) {
  if (shouldUseDemoBackend) {
    return (
      getDemoOrders().find(
        (order) => order.id === orderId && order.customerId === customerId,
      ) ?? null
    );
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "orders", orderId));

  if (!snapshot.exists()) {
    return null;
  }

  const order = mapOrder(snapshot.id, snapshot.data());

  if (order.customerId !== customerId) {
    return null;
  }

  return order;
}

export async function getAdminOrders() {
  if (shouldUseDemoBackend) {
    return getDemoOrders();
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "orders"));

  return snapshot.docs
    .map((orderDoc) => mapOrder(orderDoc.id, orderDoc.data()))
    .sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;

      return bTime - aTime;
    });
}

export async function getAdminOrderById(orderId: string) {
  if (shouldUseDemoBackend) {
    return getDemoOrderById(orderId);
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "orders", orderId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapOrder(snapshot.id, snapshot.data());
}

export async function addOrderEvent(input: {
  orderId: string;
  type: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  message: string;
  createdBy: string;
}) {
  if (shouldUseDemoBackend) {
    return;
  }

  const db = getFirebaseFirestore();

  await addDoc(collection(db, "orderEvents"), {
    ...input,
    createdAt: serverTimestamp(),
  });
}

export async function updateOrderStatus(input: {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  ownerId: string;
  message?: string;
}) {
  if (shouldUseDemoBackend) {
    updateDemoOrderStatus({
      orderId: input.orderId,
      toStatus: input.toStatus,
    });
    return;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "orders", input.orderId), {
    status: input.toStatus,
    updatedAt: serverTimestamp(),
  });

  await addOrderEvent({
    orderId: input.orderId,
    type: "status_changed",
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    message:
      input.message ??
      `Owner changed order status from ${input.fromStatus} to ${input.toStatus}.`,
    createdBy: input.ownerId,
  });

  await recordAuditLog({
    actorId: input.ownerId,
    actorRole: "owner",
    action: "order.status_changed",
    resourceType: "order",
    resourceId: input.orderId,
    summary: `Changed order status from ${input.fromStatus} to ${input.toStatus}.`,
    metadata: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
    },
  });
}

export async function setOrderFinalPrice(input: {
  orderId: string;
  finalPrice: number;
  ownerId: string;
}) {
  const paymentStatus: PaymentStatus = "unpaid";
  validateMoney(input.finalPrice, "Final price");

  if (shouldUseDemoBackend) {
    const order = getDemoOrderById(input.orderId);

    if (order?.paymentStatus === "paid") {
      throw new Error("Payment is finalized. Final price changes are locked.");
    }

    setDemoOrderFinalPrice({
      orderId: input.orderId,
      finalPrice: input.finalPrice,
    });
    return;
  }

  const db = getFirebaseFirestore();
  const order = await getAdminOrderById(input.orderId);

  if (order?.paymentStatus === "paid") {
    throw new Error("Payment is finalized. Final price changes are locked.");
  }

  await updateDoc(doc(db, "orders", input.orderId), {
    finalPrice: input.finalPrice,
    paymentStatus,
    status: "priced",
    updatedAt: serverTimestamp(),
  });

  await addOrderEvent({
    orderId: input.orderId,
    type: "price_set",
    fromStatus: null,
    toStatus: "priced",
    message: `Owner set final price to $${input.finalPrice.toFixed(2)}.`,
    createdBy: input.ownerId,
  });

  await recordAuditLog({
    actorId: input.ownerId,
    actorRole: "owner",
    action: "order.final_price_set",
    resourceType: "order",
    resourceId: input.orderId,
    summary: `Set final price to $${input.finalPrice.toFixed(2)}.`,
    metadata: {
      finalPrice: input.finalPrice,
    },
  });
}

export async function finalizeOrderPayment(input: {
  orderId: string;
  ownerId: string;
}) {
  if (shouldUseDemoBackend) {
    const order = getDemoOrderById(input.orderId);

    if (!order || order.finalPrice === null || order.finalPrice <= 0) {
      throw new Error("Save a final price before finalizing payment.");
    }

    markDemoOrderPaid(input.orderId);
    return;
  }

  const db = getFirebaseFirestore();
  const order = await getAdminOrderById(input.orderId);

  if (!order) {
    throw new Error("Order not found.");
  }

  if (order.finalPrice === null || order.finalPrice <= 0) {
    throw new Error("Save a final price before finalizing payment.");
  }

  if (order.paymentStatus === "paid") {
    throw new Error("Payment is already finalized.");
  }

  await updateDoc(doc(db, "orders", input.orderId), {
    paymentStatus: "paid" satisfies PaymentStatus,
    status: "paid" satisfies OrderStatus,
    updatedAt: serverTimestamp(),
  });

  await addOrderEvent({
    orderId: input.orderId,
    type: "payment_completed",
    fromStatus: order.status,
    toStatus: "paid",
    message: "Owner finalized payment for this order.",
    createdBy: input.ownerId,
  });

  await recordAuditLog({
    actorId: input.ownerId,
    actorRole: "owner",
    action: "payment.finalized_by_owner",
    resourceType: "payment",
    resourceId: input.orderId,
    summary: "Owner finalized payment for an order.",
    metadata: {
      orderId: input.orderId,
      finalPrice: order.finalPrice,
      fromStatus: order.status,
      toStatus: "paid",
    },
  });
}

export function formatAddress(address: AddressInput) {
  const line2 = address.street2 ? ` ${address.street2}` : "";
  return `${address.street1}${line2}, ${address.city}, ${address.state} ${address.postalCode}`;
}
