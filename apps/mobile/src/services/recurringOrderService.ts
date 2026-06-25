import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import { demoUsers } from "@/data/demoData";
import {
  comforterSizeAddOns,
  serviceAddOns,
  serviceCatalog,
} from "@/data/serviceCatalog";
import { dryCleaningItems } from "@/data/dryCleaningItems";
import type { AddOn, DryCleaningItem } from "@/types/domain";

export type RecurringOrderFrequency = "weekly" | "every_two_weeks" | "monthly";

export type RecurringOrderTemplate = {
  id: string;
  customerId: string;
  customerName?: string;
  serviceId: string;
  serviceName: string;
  frequency: RecurringOrderFrequency;
  pickupWeekday: string;
  pickupWindow: string;
  selectedAddOns: AddOn[];
  selectedDryCleaningItems: DryCleaningItem[];
  notes: string;
  active: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type SaveRecurringOrderInput = Omit<
  RecurringOrderTemplate,
  "id" | "createdAt" | "updatedAt"
> & {
  id?: string;
};

const demoRecurringOrdersStorageKey = "laundryapp.demo.recurringOrders.v1";

const defaultDemoRecurringOrders: RecurringOrderTemplate[] = [
  {
    id: "demo-recurring-weekly-jordan",
    customerId: demoUsers.customer.id,
    customerName: demoUsers.customer.displayName,
    serviceId: "wash-fold-dry-cleaning",
    serviceName:
      serviceCatalog.find((service) => service.id === "wash-fold-dry-cleaning")
        ?.name ?? "Wash and fold + dry cleaning",
    frequency: "weekly",
    pickupWeekday: "Monday",
    pickupWindow: "9:00 AM - 12:00 PM",
    selectedAddOns: [
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "separate-colors") ??
          serviceAddOns[0]),
        quantity: 1,
      },
      {
        ...(comforterSizeAddOns.find((addOn) => addOn.id === "comforter-queen") ??
          comforterSizeAddOns[1]),
        quantity: 1,
      },
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "sensitive-skin-detergent") ??
          serviceAddOns[0]),
        quantity: 1,
      },
    ],
    selectedDryCleaningItems: [
      {
        ...(dryCleaningItems.find((item) => item.id === "button-down-long-sleeve") ??
          dryCleaningItems[0]),
        quantity: 3,
      },
      {
        ...(dryCleaningItems.find((item) => item.id === "dress-pants") ??
          dryCleaningItems[1]),
        quantity: 2,
      },
    ],
    notes: "Recurring work clothes order. Please keep dry-cleaning items separate.",
    active: true,
    createdAt: new Date("2026-06-01T09:00:00"),
    updatedAt: new Date("2026-06-18T11:30:00"),
  },
  {
    id: "demo-recurring-biweekly-taylor",
    customerId: "demo-customer-2",
    customerName: "Taylor Brooks",
    serviceId: "wash-fold",
    serviceName:
      serviceCatalog.find((service) => service.id === "wash-fold")?.name ??
      "Wash and fold",
    frequency: "every_two_weeks",
    pickupWeekday: "Thursday",
    pickupWindow: "12:00 PM - 3:00 PM",
    selectedAddOns: [
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "large-washer") ??
          serviceAddOns[0]),
        quantity: 1,
      },
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "tide-detergent") ??
          serviceAddOns[0]),
        quantity: 1,
      },
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "dry-low-heat") ??
          serviceAddOns[0]),
        quantity: 1,
      },
      {
        ...(serviceAddOns.find((addOn) => addOn.id === "blanket-wash") ??
          serviceAddOns[0]),
        quantity: 2,
      },
    ],
    selectedDryCleaningItems: [],
    notes: "Family laundry every other week. Low heat for kids clothing.",
    active: true,
    createdAt: new Date("2026-06-05T14:00:00"),
    updatedAt: new Date("2026-06-19T10:15:00"),
  },
];

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function getDemoRecurringOrders() {
  const storedOrders = getStorage()?.getItem(demoRecurringOrdersStorageKey);

  if (!storedOrders) {
    return defaultDemoRecurringOrders;
  }

  try {
    return (JSON.parse(storedOrders) as RecurringOrderTemplate[]).map((order) => ({
      ...order,
      selectedAddOns: order.selectedAddOns ?? [],
      selectedDryCleaningItems: order.selectedDryCleaningItems ?? [],
    }));
  } catch {
    getStorage()?.removeItem(demoRecurringOrdersStorageKey);
    return [];
  }
}

function saveDemoRecurringOrders(orders: RecurringOrderTemplate[]) {
  getStorage()?.setItem(demoRecurringOrdersStorageKey, JSON.stringify(orders));
}

function mapRecurringOrderTemplate(id: string, data: DocumentData): RecurringOrderTemplate {
  return {
    id,
    customerId: data.customerId ?? "",
    customerName: data.customerName ?? "",
    serviceId: data.serviceId ?? "",
    serviceName: data.serviceName ?? "",
    frequency: data.frequency ?? "weekly",
    pickupWeekday: data.pickupWeekday ?? "Monday",
    pickupWindow: data.pickupWindow ?? "",
    selectedAddOns: data.selectedAddOns ?? [],
    selectedDryCleaningItems: data.selectedDryCleaningItems ?? [],
    notes: data.notes ?? "",
    active: data.active ?? true,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

function normalizeRecurringOrderInput(input: SaveRecurringOrderInput) {
  return {
    customerId: input.customerId,
    customerName: input.customerName?.trim() ?? "",
    serviceId: input.serviceId,
    serviceName: input.serviceName.trim(),
    frequency: input.frequency,
    pickupWeekday: input.pickupWeekday,
    pickupWindow: input.pickupWindow,
    selectedAddOns: input.selectedAddOns.map((addOn) => ({
      ...addOn,
      description: addOn.description.trim(),
      name: addOn.name.trim(),
      quantity: addOn.quantity ?? 1,
    })),
    selectedDryCleaningItems: input.selectedDryCleaningItems.map((item) => ({
      ...item,
      description: item.description.trim(),
      name: item.name.trim(),
      quantity: item.quantity ?? 1,
    })),
    notes: input.notes.trim(),
    active: input.active,
  };
}

export async function getCustomerRecurringOrders(customerId: string) {
  if (shouldUseDemoBackend) {
    return getDemoRecurringOrders().filter((order) => order.customerId === customerId);
  }

  const db = getFirebaseFirestore();
  const recurringOrdersQuery = query(
    collection(db, "recurringOrders"),
    where("customerId", "==", customerId),
  );
  const snapshot = await getDocs(recurringOrdersQuery);

  return snapshot.docs.map((orderDoc) =>
    mapRecurringOrderTemplate(orderDoc.id, orderDoc.data()),
  );
}

export async function getActiveRecurringOrders() {
  if (shouldUseDemoBackend) {
    return getDemoRecurringOrders().filter((order) => order.active);
  }

  const db = getFirebaseFirestore();
  const recurringOrdersQuery = query(
    collection(db, "recurringOrders"),
    where("active", "==", true),
  );
  const snapshot = await getDocs(recurringOrdersQuery);

  return snapshot.docs.map((orderDoc) =>
    mapRecurringOrderTemplate(orderDoc.id, orderDoc.data()),
  );
}

export async function saveRecurringOrderTemplate(input: SaveRecurringOrderInput) {
  const normalizedInput = normalizeRecurringOrderInput(input);
  const id = input.id ?? `recurring-${Date.now()}`;

  if (shouldUseDemoBackend) {
    const now = new Date();
    const orders = getDemoRecurringOrders();
    const existingOrder = orders.find((order) => order.id === id);
    const nextOrder: RecurringOrderTemplate = {
      ...normalizedInput,
      id,
      createdAt: existingOrder?.createdAt ?? now,
      updatedAt: now,
    };

    saveDemoRecurringOrders(
      existingOrder
        ? orders.map((order) => (order.id === id ? nextOrder : order))
        : [...orders, nextOrder],
    );

    return nextOrder;
  }

  const db = getFirebaseFirestore();
  const orderRef = doc(db, "recurringOrders", id);
  const timestampFields = input.id
    ? { updatedAt: serverTimestamp() }
    : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

  await setDoc(
    orderRef,
    {
      ...normalizedInput,
      ...timestampFields,
    },
    { merge: true },
  );

  return {
    ...normalizedInput,
    id,
    createdAt: null,
    updatedAt: null,
  };
}

export async function deleteRecurringOrderTemplate(
  customerId: string,
  recurringOrderId: string,
) {
  if (shouldUseDemoBackend) {
    saveDemoRecurringOrders(
      getDemoRecurringOrders().filter(
        (order) => order.customerId !== customerId || order.id !== recurringOrderId,
      ),
    );
    return;
  }

  const db = getFirebaseFirestore();
  await deleteDoc(doc(db, "recurringOrders", recurringOrderId));
}
