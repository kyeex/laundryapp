import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import {
  getFirebaseFirestore,
  getFirebaseFunctions,
  shouldUseDemoBackend,
} from "@/config/firebase";
import { demoUsers } from "@/data/demoData";
import { requestPasswordReset } from "@/services/authService";
import type { AppUser, UserRole } from "@/types/domain";
import { requireText } from "@/utils/validation";

export type ManagedUserInput = {
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
};

type CreateManagedUserResult = {
  user: AppUser;
};

const demoManagedUsersStorageKey = "laundryapp.demo.managedUsers.v1";

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function normalizeUserInput(input: ManagedUserInput): ManagedUserInput {
  requireText(input.displayName, "Display name");
  requireText(input.email, "Email");

  return {
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    role: input.role,
  };
}

function getDemoManagedUsers() {
  const storedUsers = getStorage()?.getItem(demoManagedUsersStorageKey);

  if (!storedUsers) {
    return [];
  }

  try {
    return JSON.parse(storedUsers) as AppUser[];
  } catch {
    getStorage()?.removeItem(demoManagedUsersStorageKey);
    return [];
  }
}

function saveDemoManagedUsers(users: AppUser[]) {
  getStorage()?.setItem(demoManagedUsersStorageKey, JSON.stringify(users));
}

export function resetDemoManagedUsers() {
  getStorage()?.removeItem(demoManagedUsersStorageKey);
}

function getDemoUserDirectory() {
  const storedUsers = getDemoManagedUsers();

  return storedUsers.length > 0 ? storedUsers : Object.values(demoUsers);
}

export async function getManagedUsers() {
  if (shouldUseDemoBackend) {
    return getDemoUserDirectory().sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  const db = getFirebaseFirestore();
  const usersQuery = query(collection(db, "users"), orderBy("displayName", "asc"));
  const snapshot = await getDocs(usersQuery);

  return snapshot.docs.map((userDoc) => {
    const data = userDoc.data();

    return {
      id: userDoc.id,
      email: data.email ?? "",
      role: data.role ?? "customer",
      displayName: data.displayName ?? "",
      phone: data.phone ?? "",
      active: data.active ?? true,
      expoPushTokens: data.expoPushTokens ?? [],
      createdAt: data.createdAt?.toDate?.() ?? null,
      updatedAt: data.updatedAt?.toDate?.() ?? null,
    } satisfies AppUser;
  });
}

export async function createManagedUser(input: ManagedUserInput) {
  const normalizedInput = normalizeUserInput(input);

  if (shouldUseDemoBackend) {
    const demoUsersList = getDemoUserDirectory();
    const newUser: AppUser = {
      id: `demo-managed-${Date.now()}`,
      ...normalizedInput,
      active: true,
      expoPushTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    saveDemoManagedUsers([...demoUsersList, newUser]);
    return newUser;
  }

  const createUser = httpsCallable<ManagedUserInput, CreateManagedUserResult>(
    getFirebaseFunctions(),
    "createManagedUserAccount",
  );
  const result = await createUser(normalizedInput);

  await requestPasswordReset(normalizedInput.email);

  return {
    ...result.data.user,
    createdAt: null,
    updatedAt: null,
  };
}

export async function updateManagedUser(
  userId: string,
  updates: Partial<Pick<AppUser, "active" | "role" | "displayName" | "phone">>,
) {
  if (shouldUseDemoBackend) {
    const nextUsers = getDemoUserDirectory().map((user) =>
      user.id === userId
        ? {
            ...user,
            ...updates,
            updatedAt: new Date(),
          }
        : user,
    );

    saveDemoManagedUsers(nextUsers);
    return;
  }

  const updateUserAccess = httpsCallable<
    { userId: string; updates: typeof updates },
    { user: AppUser }
  >(getFirebaseFunctions(), "updateManagedUserAccess");
  await updateUserAccess({ userId, updates });
}

export async function sendManagedUserPasswordReset(email: string) {
  requireText(email, "Email");

  if (shouldUseDemoBackend) {
    return;
  }

  await requestPasswordReset(email.trim());
}

export async function provisionManagedUserProfile(input: ManagedUserInput & { id: string }) {
  const normalizedInput = normalizeUserInput(input);

  if (shouldUseDemoBackend) {
    return createManagedUser(normalizedInput);
  }

  const db = getFirebaseFirestore();
  await setDoc(doc(db, "users", input.id), {
    ...normalizedInput,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
