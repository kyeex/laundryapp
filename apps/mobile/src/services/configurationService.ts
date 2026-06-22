import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { getFirebaseFirestore, isFirebaseConfigured } from "@/config/firebase";
import {
  defaultBusinessSettings,
  defaultPickupWindows,
  comforterSizeAddOns,
  serviceAddOns,
  serviceCatalog,
} from "@/data/serviceCatalog";
import { dryCleaningItems } from "@/data/dryCleaningItems";
import type {
  AddOn,
  BusinessSettings,
  DryCleaningItem,
  PickupWindow,
  Service,
} from "@/types/domain";
import {
  validateAddOn,
  validateBusinessSettings,
  validatePickupWindow,
  validateService,
} from "@/utils/validation";

function sortBySortOrder<T extends { sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

const demoBusinessSettingsStorageKey = "laundryapp.demo.businessSettings.v1";
const demoServicesStorageKey = "laundryapp.demo.services.v1";
const demoAddOnsStorageKey = "laundryapp.demo.addOns.v1";
const demoComforterSizesStorageKey = "laundryapp.demo.comforterSizes.v1";
const demoDryCleaningItemsStorageKey = "laundryapp.demo.dryCleaningItems.v1";
const demoPickupWindowsStorageKey = "laundryapp.demo.pickupWindows.v2";
const legacyDefaultPickupWindowLabels = new Set([
  "9:00 AM - 11:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
]);

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function getDemoBusinessSettings() {
  const storedSettings = getStorage()?.getItem(demoBusinessSettingsStorageKey);

  if (!storedSettings) {
    return defaultBusinessSettings;
  }

  try {
    return {
      ...defaultBusinessSettings,
      ...(JSON.parse(storedSettings) as Partial<BusinessSettings>),
      pickupAvailability: {
        ...defaultBusinessSettings.pickupAvailability,
        ...(JSON.parse(storedSettings) as Partial<BusinessSettings>).pickupAvailability,
      },
    };
  } catch {
    getStorage()?.removeItem(demoBusinessSettingsStorageKey);
    return defaultBusinessSettings;
  }
}

function getDemoItems<T>(storageKey: string, defaults: T[]) {
  const storedItems = getStorage()?.getItem(storageKey);

  if (!storedItems) {
    return defaults;
  }

  try {
    return JSON.parse(storedItems) as T[];
  } catch {
    getStorage()?.removeItem(storageKey);
    return defaults;
  }
}

function isLegacyDefaultPickupWindowSet(items: PickupWindow[]) {
  return (
    items.length === legacyDefaultPickupWindowLabels.size &&
    items.every((item) => legacyDefaultPickupWindowLabels.has(item.label))
  );
}

function getDemoPickupWindows() {
  const storedItems = getStorage()?.getItem(demoPickupWindowsStorageKey);

  if (!storedItems) {
    return defaultPickupWindows;
  }

  try {
    const parsedItems = JSON.parse(storedItems) as PickupWindow[];

    if (isLegacyDefaultPickupWindowSet(parsedItems)) {
      getStorage()?.setItem(
        demoPickupWindowsStorageKey,
        JSON.stringify(defaultPickupWindows),
      );
      return defaultPickupWindows;
    }

    return parsedItems;
  } catch {
    getStorage()?.removeItem(demoPickupWindowsStorageKey);
    return defaultPickupWindows;
  }
}

function saveDemoItem<T extends { id: string }>(
  storageKey: string,
  defaults: T[],
  item: T,
) {
  const items = getDemoItems(storageKey, defaults);
  const nextItems = items.some((current) => current.id === item.id)
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item];

  getStorage()?.setItem(storageKey, JSON.stringify(nextItems));
}

export async function getServices() {
  if (!isFirebaseConfigured) {
    return sortBySortOrder(getDemoItems(demoServicesStorageKey, serviceCatalog));
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "services"));

  if (snapshot.empty) {
    return sortBySortOrder(serviceCatalog);
  }

  return sortBySortOrder(
    snapshot.docs.map((serviceDoc) => ({
      id: serviceDoc.id,
      ...(serviceDoc.data() as Omit<Service, "id">),
    })),
  );
}

export async function getActiveServices() {
  return (await getServices()).filter((service) => service.active);
}

export async function saveService(service: Service) {
  validateService(service);

  if (!isFirebaseConfigured) {
    saveDemoItem(demoServicesStorageKey, serviceCatalog, service);
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "services", service.id), {
    name: service.name.trim(),
    description: service.description.trim(),
    basePrice: service.basePrice,
    active: service.active,
    sortOrder: service.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

export async function getAddOns() {
  if (!isFirebaseConfigured) {
    return sortBySortOrder(getDemoItems(demoAddOnsStorageKey, serviceAddOns));
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "addOns"));

  if (snapshot.empty) {
    return sortBySortOrder(serviceAddOns);
  }

  return sortBySortOrder(
    snapshot.docs.map((addOnDoc) => ({
      id: addOnDoc.id,
      ...(addOnDoc.data() as Omit<AddOn, "id">),
    })),
  );
}

export async function getActiveAddOns() {
  return (await getAddOns()).filter((addOn) => addOn.active);
}

export async function saveAddOn(addOn: AddOn) {
  validateAddOn(addOn);

  if (!isFirebaseConfigured) {
    saveDemoItem(demoAddOnsStorageKey, serviceAddOns, addOn);
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "addOns", addOn.id), {
    name: addOn.name.trim(),
    description: addOn.description.trim(),
    price: addOn.price,
    active: addOn.active,
    requiresOwnerConfirmation: addOn.requiresOwnerConfirmation,
    sortOrder: addOn.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

export async function getPickupWindows() {
  if (!isFirebaseConfigured) {
    return sortBySortOrder(getDemoPickupWindows());
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "pickupWindows"));

  if (snapshot.empty) {
    return sortBySortOrder(defaultPickupWindows);
  }

  return sortBySortOrder(
    snapshot.docs.map((windowDoc) => ({
      id: windowDoc.id,
      ...(windowDoc.data() as Omit<PickupWindow, "id">),
    })),
  );
}

export async function getActivePickupWindows() {
  return (await getPickupWindows()).filter((window) => window.active);
}

export async function savePickupWindow(pickupWindow: PickupWindow) {
  validatePickupWindow(pickupWindow);

  if (!isFirebaseConfigured) {
    saveDemoItem(demoPickupWindowsStorageKey, defaultPickupWindows, pickupWindow);
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "pickupWindows", pickupWindow.id), {
    label: pickupWindow.label.trim(),
    active: pickupWindow.active,
    sortOrder: pickupWindow.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

export async function getBusinessSettings() {
  if (!isFirebaseConfigured) {
    return getDemoBusinessSettings();
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "settings", "business"));

  if (!snapshot.exists()) {
    return defaultBusinessSettings;
  }

  return {
    ...defaultBusinessSettings,
    ...(snapshot.data() as Partial<BusinessSettings>),
    pickupAvailability: {
      ...defaultBusinessSettings.pickupAvailability,
      ...(snapshot.data() as Partial<BusinessSettings>).pickupAvailability,
    },
  };
}

export async function saveBusinessSettings(settings: BusinessSettings) {
  validateBusinessSettings(settings);

  if (!isFirebaseConfigured) {
    getStorage()?.setItem(demoBusinessSettingsStorageKey, JSON.stringify(settings));
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "settings", "business"), {
    businessName: settings.businessName.trim(),
    phone: settings.phone.trim(),
    serviceAreaNotes: settings.serviceAreaNotes.trim(),
    laundryPricePerPound: settings.laundryPricePerPound,
    deliveryMinimumPounds: settings.deliveryMinimumPounds,
    gratuityRateOptions: settings.gratuityRateOptions,
    pickupAvailability: settings.pickupAvailability,
    updatedAt: serverTimestamp(),
  });
}

export async function getComforterSizeAddOns() {
  if (!isFirebaseConfigured) {
    return sortBySortOrder(
      getDemoItems(demoComforterSizesStorageKey, comforterSizeAddOns),
    );
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "comforterSizeAddOns"));

  if (snapshot.empty) {
    return sortBySortOrder(comforterSizeAddOns);
  }

  return sortBySortOrder(
    snapshot.docs.map((addOnDoc) => ({
      id: addOnDoc.id,
      ...(addOnDoc.data() as Omit<AddOn, "id">),
    })),
  );
}

export async function getActiveComforterSizeAddOns() {
  return (await getComforterSizeAddOns()).filter((addOn) => addOn.active);
}

export async function saveComforterSizeAddOn(addOn: AddOn) {
  validateAddOn(addOn);

  if (!isFirebaseConfigured) {
    saveDemoItem(demoComforterSizesStorageKey, comforterSizeAddOns, addOn);
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "comforterSizeAddOns", addOn.id), {
    name: addOn.name.trim(),
    description: addOn.description.trim(),
    price: addOn.price,
    active: addOn.active,
    requiresOwnerConfirmation: addOn.requiresOwnerConfirmation,
    sortOrder: addOn.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

export async function getDryCleaningItems() {
  if (!isFirebaseConfigured) {
    return sortBySortOrder(
      getDemoItems(demoDryCleaningItemsStorageKey, dryCleaningItems),
    );
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "dryCleaningItems"));

  if (snapshot.empty) {
    return sortBySortOrder(dryCleaningItems);
  }

  return sortBySortOrder(
    snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...(itemDoc.data() as Omit<DryCleaningItem, "id">),
    })),
  );
}

export async function getActiveDryCleaningItems() {
  return (await getDryCleaningItems()).filter((item) => item.active);
}

export async function saveDryCleaningItem(item: DryCleaningItem) {
  validateService({
    id: item.id,
    name: item.name,
    description: item.description,
    basePrice: item.price,
    active: item.active,
    sortOrder: item.sortOrder,
  });

  if (!isFirebaseConfigured) {
    saveDemoItem(demoDryCleaningItemsStorageKey, dryCleaningItems, item);
    return;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "dryCleaningItems", item.id), {
    name: item.name.trim(),
    description: item.description.trim(),
    price: item.price,
    active: item.active,
    sortOrder: item.sortOrder,
    updatedAt: serverTimestamp(),
  });
}

export function resetDemoBusinessSettings() {
  if (!isFirebaseConfigured) {
    getStorage()?.removeItem(demoBusinessSettingsStorageKey);
    getStorage()?.removeItem(demoServicesStorageKey);
    getStorage()?.removeItem(demoAddOnsStorageKey);
    getStorage()?.removeItem(demoComforterSizesStorageKey);
    getStorage()?.removeItem(demoDryCleaningItemsStorageKey);
    getStorage()?.removeItem(demoPickupWindowsStorageKey);
  }
}
