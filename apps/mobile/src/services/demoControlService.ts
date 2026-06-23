import { shouldUseDemoBackend } from "@/config/firebase";
import { getFirebaseFunctions } from "@/config/firebase";
import { resetDemoOrders, seedFreshDemoOrders } from "@/data/demoStore";
import { resetDemoManagedUsers } from "@/services/adminUserService";
import { httpsCallable } from "firebase/functions";

export type StagingSeedUser = {
  uid: string;
  email: string;
  displayName: string;
  role: "customer" | "owner" | "driver" | "admin";
};

export type StagingSeedUsersResult = {
  projectId: string;
  seedTag: string;
  password: string;
  users: StagingSeedUser[];
  createdCount: number;
  updatedCount: number;
};

export type StagingSeedOrdersResult = {
  projectId: string;
  seedTag: string;
  orderIds: string[];
  createdOrderCount: number;
};

export type StagingResetResult = {
  projectId: string;
  seedTag: string;
  deleted: Record<string, number>;
  preservedUsers: boolean;
};

export type StagingSeedStatus = {
  projectId: string;
  seedTag: string;
  userCount: number;
  orderCount: number;
  batchCount: number;
  addressCount: number;
};

export function resetLocalDemoData() {
  if (!shouldUseDemoBackend) {
    throw new Error("Demo reset is disabled when Firebase is connected.");
  }

  resetDemoOrders();
  resetDemoManagedUsers();
}

export function seedLocalDemoOrders() {
  if (!shouldUseDemoBackend) {
    throw new Error("Demo seeding is disabled when Firebase is connected.");
  }

  return seedFreshDemoOrders();
}

export async function getStagingSeedStatus() {
  if (shouldUseDemoBackend) {
    throw new Error("Staging seed status is only available in Firebase staging mode.");
  }

  const getStatus = httpsCallable<void, StagingSeedStatus>(
    getFirebaseFunctions(),
    "getStagingSeedStatus",
  );
  const result = await getStatus();

  return result.data;
}

export async function seedStagingUsers() {
  if (shouldUseDemoBackend) {
    throw new Error("Staging user seeding is disabled in local demo mode.");
  }

  const seedUsers = httpsCallable<void, StagingSeedUsersResult>(
    getFirebaseFunctions(),
    "seedStagingUsers",
  );
  const result = await seedUsers();

  return result.data;
}

export async function seedStagingSampleOrders() {
  if (shouldUseDemoBackend) {
    throw new Error("Staging order seeding is disabled in local demo mode.");
  }

  const seedOrders = httpsCallable<void, StagingSeedOrdersResult>(
    getFirebaseFunctions(),
    "seedStagingSampleOrders",
  );
  const result = await seedOrders();

  return result.data;
}

export async function resetStagingDemoData() {
  if (shouldUseDemoBackend) {
    throw new Error("Staging reset is disabled in local demo mode.");
  }

  const resetData = httpsCallable<void, StagingResetResult>(
    getFirebaseFunctions(),
    "resetStagingDemoData",
  );
  const result = await resetData();

  return result.data;
}
