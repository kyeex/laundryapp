import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import { demoUsers } from "@/data/demoData";
import {
  defaultNotificationPreferences,
  type AddressInput,
  type AppUser,
  type NotificationPreferences,
  type UserRole,
} from "@/types/domain";
import { requireText, validateAddress } from "@/utils/validation";

type CreateUserProfileInput = {
  id: string;
  email: string;
  displayName: string;
  phone: string;
  role: Extract<UserRole, "customer">;
};

export type CustomerProfileSummary = {
  displayName: string;
  phone: string;
  email: string;
  defaultAddress: AddressInput;
  paymentMethod: CustomerPaymentMethod;
};

export type CustomerPaymentMethod = {
  cardholderName: string;
  brand: string;
  last4: string;
  expirationMonth: string;
  expirationYear: string;
};

export type CustomerLaundryPreferences = {
  detergentPreference: string;
  fabricSoftenerPreference: string;
  foldingPreference: string;
  hangerPreference: string;
  scentPreference: string;
  separationPreference: string;
  specialInstructions: string;
};

const defaultCustomerAddress: AddressInput = {
  label: "Home",
  street1: "241 Cedar Street",
  street2: "Apt 4C",
  city: "Brooklyn",
  state: "NY",
  postalCode: "11231",
  deliveryInstructions: "Text when outside. Laundry bags are by the front door.",
};
const defaultPaymentMethod: CustomerPaymentMethod = {
  cardholderName: "",
  brand: "",
  last4: "",
  expirationMonth: "",
  expirationYear: "",
};
const demoCustomerProfileStorageKey = "laundryapp.demo.customerProfile.v1";
const demoLaundryPreferencesStorageKey = "laundryapp.demo.laundryPreferences.v1";

const defaultLaundryPreferences: CustomerLaundryPreferences = {
  detergentPreference: "Hypoallergenic detergent preferred.",
  fabricSoftenerPreference: "No fabric softener unless requested.",
  foldingPreference: "Fold everyday laundry together.",
  hangerPreference: "No hangers needed.",
  scentPreference: "Light or fragrance-free scent preferred.",
  separationPreference: "Separate towels from clothing.",
  specialInstructions: "Please handle dry-cleaning items separately.",
};

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function mapUserProfile(id: string, data: DocumentData): AppUser {
  return {
    id,
    email: data.email ?? "",
    role: data.role ?? "customer",
    displayName: data.displayName ?? "",
    phone: data.phone ?? "",
    active: data.active ?? true,
    expoPushTokens: data.expoPushTokens ?? [],
    notificationPreferences: {
      ...defaultNotificationPreferences,
      ...(data.notificationPreferences ?? {}),
    },
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

function normalizePaymentMethod(
  paymentMethod: Partial<CustomerPaymentMethod> | undefined,
) {
  return {
    cardholderName: paymentMethod?.cardholderName?.trim() ?? "",
    brand: paymentMethod?.brand?.trim() ?? "",
    last4: (paymentMethod?.last4 ?? "").replace(/\D/g, "").slice(-4),
    expirationMonth: (paymentMethod?.expirationMonth ?? "")
      .replace(/\D/g, "")
      .slice(0, 2),
    expirationYear: (paymentMethod?.expirationYear ?? "")
      .replace(/\D/g, "")
      .slice(0, 4),
  };
}

export async function getUserProfile(userId: string) {
  if (shouldUseDemoBackend) {
    return Object.values(demoUsers).find((user) => user.id === userId) ?? null;
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "users", userId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data());
}

export async function getCustomerProfileSummary(userId: string) {
  if (shouldUseDemoBackend) {
    const storedProfile = getStorage()?.getItem(demoCustomerProfileStorageKey);

    if (storedProfile) {
      try {
        const parsedProfile = JSON.parse(storedProfile) as Partial<CustomerProfileSummary>;

        return {
          displayName: parsedProfile.displayName ?? "",
          phone: parsedProfile.phone ?? "",
          email: parsedProfile.email ?? "",
          defaultAddress: parsedProfile.defaultAddress ?? defaultCustomerAddress,
          paymentMethod: normalizePaymentMethod(parsedProfile.paymentMethod),
        };
      } catch {
        getStorage()?.removeItem(demoCustomerProfileStorageKey);
      }
    }

    const user = demoUsers.customer;

    return {
      displayName: user.displayName,
      phone: user.phone,
      email: user.email,
      defaultAddress: defaultCustomerAddress,
      paymentMethod: defaultPaymentMethod,
    };
  }

  const db = getFirebaseFirestore();
  const user = await getUserProfile(userId);
  const addressSnapshot = await getDoc(doc(db, "addresses", `${userId}-default`));
  const customerProfileSnapshot = await getDoc(doc(db, "customerProfiles", userId));
  const customerProfileData = customerProfileSnapshot.data() as
    | { paymentMethod?: Partial<CustomerPaymentMethod> }
    | undefined;

  return {
    displayName: user?.displayName ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    defaultAddress: addressSnapshot.exists()
      ? (addressSnapshot.data() as AddressInput)
      : {
          label: "Home",
          street1: "",
          street2: "",
          city: "",
          state: "",
          postalCode: "",
          deliveryInstructions: "",
        },
    paymentMethod: normalizePaymentMethod(customerProfileData?.paymentMethod),
  };
}

export async function saveCustomerProfileSummary(
  userId: string,
  profile: CustomerProfileSummary,
) {
  requireText(profile.displayName, "Name");
  requireText(profile.email, "Email");
  validateAddress(profile.defaultAddress);

  const normalizedProfile: CustomerProfileSummary = {
    displayName: profile.displayName.trim(),
    phone: profile.phone.trim(),
    email: profile.email.trim(),
    paymentMethod: normalizePaymentMethod(profile.paymentMethod),
    defaultAddress: {
      ...profile.defaultAddress,
      label: profile.defaultAddress.label.trim() || "Home",
      street1: profile.defaultAddress.street1.trim(),
      street2: profile.defaultAddress.street2.trim(),
      city: profile.defaultAddress.city.trim(),
      state: profile.defaultAddress.state.trim().toUpperCase(),
      postalCode: profile.defaultAddress.postalCode.trim(),
      deliveryInstructions: profile.defaultAddress.deliveryInstructions.trim(),
    },
  };

  if (shouldUseDemoBackend) {
    getStorage()?.setItem(
      demoCustomerProfileStorageKey,
      JSON.stringify(normalizedProfile),
    );
    return normalizedProfile;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "users", userId), {
    displayName: normalizedProfile.displayName,
    phone: normalizedProfile.phone,
    email: normalizedProfile.email,
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "addresses", `${userId}-default`), {
    ...normalizedProfile.defaultAddress,
    userId,
    updatedAt: serverTimestamp(),
  });
  await setDoc(
    doc(db, "customerProfiles", userId),
    {
      userId,
      defaultAddressId: `${userId}-default`,
      paymentMethod: normalizedProfile.paymentMethod,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalizedProfile;
}

export async function saveCustomerPaymentMethod(
  userId: string,
  paymentMethod: CustomerPaymentMethod,
) {
  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

  if (shouldUseDemoBackend) {
    const storedProfile = getStorage()?.getItem(demoCustomerProfileStorageKey);
    let currentProfile: CustomerProfileSummary | null = null;

    if (storedProfile) {
      try {
        currentProfile = JSON.parse(storedProfile) as CustomerProfileSummary;
      } catch {
        getStorage()?.removeItem(demoCustomerProfileStorageKey);
      }
    }

    const user = demoUsers.customer;
    const nextProfile: CustomerProfileSummary = {
      displayName: currentProfile?.displayName ?? user.displayName,
      phone: currentProfile?.phone ?? user.phone,
      email: currentProfile?.email ?? user.email,
      defaultAddress: currentProfile?.defaultAddress ?? defaultCustomerAddress,
      paymentMethod: normalizedPaymentMethod,
    };

    getStorage()?.setItem(demoCustomerProfileStorageKey, JSON.stringify(nextProfile));
    return normalizedPaymentMethod;
  }

  const db = getFirebaseFirestore();

  await setDoc(
    doc(db, "customerProfiles", userId),
    {
      userId,
      paymentMethod: normalizedPaymentMethod,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return normalizedPaymentMethod;
}

export async function getCustomerLaundryPreferences(userId: string) {
  if (shouldUseDemoBackend) {
    const storedPreferences = getStorage()?.getItem(demoLaundryPreferencesStorageKey);

    if (storedPreferences) {
      try {
        return {
          ...defaultLaundryPreferences,
          ...(JSON.parse(storedPreferences) as Partial<CustomerLaundryPreferences>),
        };
      } catch {
        getStorage()?.removeItem(demoLaundryPreferencesStorageKey);
      }
    }

    return defaultLaundryPreferences;
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "customerPreferences", userId));

  if (!snapshot.exists()) {
    return {
      detergentPreference: "",
      fabricSoftenerPreference: "",
      foldingPreference: "",
      hangerPreference: "",
      scentPreference: "",
      separationPreference: "",
      specialInstructions: "",
    };
  }

  return {
    ...defaultLaundryPreferences,
    ...(snapshot.data() as Partial<CustomerLaundryPreferences>),
  };
}

export async function saveCustomerLaundryPreferences(
  userId: string,
  preferences: CustomerLaundryPreferences,
) {
  const normalizedPreferences: CustomerLaundryPreferences = {
    detergentPreference: preferences.detergentPreference.trim(),
    fabricSoftenerPreference: preferences.fabricSoftenerPreference.trim(),
    foldingPreference: preferences.foldingPreference.trim(),
    hangerPreference: preferences.hangerPreference.trim(),
    scentPreference: preferences.scentPreference.trim(),
    separationPreference: preferences.separationPreference.trim(),
    specialInstructions: preferences.specialInstructions.trim(),
  };

  if (shouldUseDemoBackend) {
    getStorage()?.setItem(
      demoLaundryPreferencesStorageKey,
      JSON.stringify(normalizedPreferences),
    );
    return normalizedPreferences;
  }

  const db = getFirebaseFirestore();

  await setDoc(doc(db, "customerPreferences", userId), {
    ...normalizedPreferences,
    userId,
    updatedAt: serverTimestamp(),
  });

  return normalizedPreferences;
}

export async function createUserProfile(input: CreateUserProfileInput) {
  requireText(input.email, "Email");
  requireText(input.displayName, "Display name");

  if (shouldUseDemoBackend) {
    return getUserProfile(input.id);
  }

  const db = getFirebaseFirestore();
  const userRef = doc(db, "users", input.id);
  await setDoc(userRef, {
    email: input.email.trim(),
    role: input.role,
    displayName: input.displayName.trim(),
    phone: input.phone.trim(),
    active: true,
    expoPushTokens: [],
    notificationPreferences: defaultNotificationPreferences,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.role === "customer") {
    await setDoc(doc(db, "customerProfiles", input.id), {
      userId: input.id,
      defaultAddressId: null,
      notes: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return getUserProfile(input.id);
}

export async function getActiveDrivers() {
  if (shouldUseDemoBackend) {
    return [demoUsers.driver];
  }

  const db = getFirebaseFirestore();
  const driversQuery = query(
    collection(db, "users"),
    where("role", "==", "driver"),
    where("active", "==", true),
  );
  const snapshot = await getDocs(driversQuery);

  return snapshot.docs.map((driverDoc) =>
    mapUserProfile(driverDoc.id, driverDoc.data()),
  );
}

export async function saveExpoPushToken(userId: string, token: string) {
  if (shouldUseDemoBackend) {
    return;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "users", userId), {
    expoPushTokens: arrayUnion(token),
    updatedAt: serverTimestamp(),
  });
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  if (shouldUseDemoBackend) {
    return;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "users", userId), {
    notificationPreferences: {
      ...defaultNotificationPreferences,
      ...preferences,
    },
    updatedAt: serverTimestamp(),
  });
}
