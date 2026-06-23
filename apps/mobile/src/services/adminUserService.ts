import {
  deleteApp,
  initializeApp,
  type FirebaseError,
} from "firebase/app";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
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
  firebaseConfig,
  getFirebaseAuth,
  getFirebaseFirestore,
  getFirebaseFunctions,
  shouldUseDemoBackend,
} from "@/config/firebase";
import { demoUsers } from "@/data/demoData";
import { recordAuditLog } from "@/services/auditLogService";
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
const fallbackFunctionCodes = new Set([
  "functions/internal",
  "functions/not-found",
  "functions/unavailable",
  "functions/unknown",
]);

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

function shouldUseStagingFallback(error: unknown) {
  const errorCode = (error as FirebaseError | undefined)?.code;

  return errorCode ? fallbackFunctionCodes.has(errorCode) : false;
}

async function recordFallbackAdminAudit(input: {
  action: string;
  resourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const actorId = getFirebaseAuth().currentUser?.uid;

  if (!actorId) {
    return;
  }

  await recordAuditLog({
    actorId,
    actorRole: "admin",
    resourceType: "user",
    ...input,
  });
}

async function createManagedUserWithoutFunctions(input: ManagedUserInput) {
  const db = getFirebaseFirestore();
  const temporaryApp = initializeApp(
    firebaseConfig,
    `managed-user-create-${Date.now()}`,
  );
  const temporaryAuth = getAuth(temporaryApp);
  const temporaryPassword = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}Temp!`;
  let createdAuthUser: User | null = null;

  try {
    const credential = await createUserWithEmailAndPassword(
      temporaryAuth,
      input.email,
      temporaryPassword,
    );
    createdAuthUser = credential.user;

    await updateProfile(credential.user, {
      displayName: input.displayName,
    });

    const user: AppUser = {
      id: credential.user.uid,
      ...input,
      active: true,
      expoPushTokens: [],
      createdAt: null,
      updatedAt: null,
    };

    await setDoc(doc(db, "users", credential.user.uid), {
      email: input.email,
      role: input.role,
      displayName: input.displayName,
      phone: input.phone,
      active: true,
      expoPushTokens: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.role === "customer") {
      await setDoc(doc(db, "customerProfiles", credential.user.uid), {
        userId: credential.user.uid,
        defaultAddressId: null,
        notes: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (input.role === "driver") {
      await setDoc(doc(db, "driverProfiles", credential.user.uid), {
        userId: credential.user.uid,
        active: true,
        phone: input.phone,
        vehicleInfo: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await sendPasswordResetEmail(temporaryAuth, input.email);
    return user;
  } catch (error) {
    if (createdAuthUser) {
      await deleteUser(createdAuthUser).catch(() => undefined);
    }

    throw error;
  } finally {
    await signOut(temporaryAuth).catch(() => undefined);
    await deleteApp(temporaryApp).catch(() => undefined);
  }
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

  try {
    const result = await createUser(normalizedInput);

    await requestPasswordReset(normalizedInput.email);

    return {
      ...result.data.user,
      createdAt: null,
      updatedAt: null,
    };
  } catch (createError) {
    if (!shouldUseStagingFallback(createError)) {
      throw createError;
    }

    const fallbackUser = await createManagedUserWithoutFunctions(normalizedInput);

    await recordFallbackAdminAudit({
      action: "user.created",
      resourceId: fallbackUser.id,
      summary: `Created ${fallbackUser.role} user ${fallbackUser.email}.`,
      metadata: {
        email: fallbackUser.email,
        role: fallbackUser.role,
        fallback: true,
      },
    });

    return fallbackUser;
  }
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

  try {
    await updateUserAccess({ userId, updates });
  } catch (updateError) {
    if (!shouldUseStagingFallback(updateError)) {
      throw updateError;
    }

    const db = getFirebaseFirestore();
    await setDoc(
      doc(db, "users", userId),
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await recordFallbackAdminAudit({
      action: "user.access_updated",
      resourceId: userId,
      summary: "Updated user access settings.",
      metadata: {
        updates,
        fallback: true,
      },
    });
  }
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
