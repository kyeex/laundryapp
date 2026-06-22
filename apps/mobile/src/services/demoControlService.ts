import { isFirebaseConfigured } from "@/config/firebase";
import { resetDemoOrders, seedFreshDemoOrders } from "@/data/demoStore";
import { resetDemoManagedUsers } from "@/services/adminUserService";

export function resetLocalDemoData() {
  if (isFirebaseConfigured) {
    throw new Error("Demo reset is disabled when Firebase is connected.");
  }

  resetDemoOrders();
  resetDemoManagedUsers();
}

export function seedLocalDemoOrders() {
  if (isFirebaseConfigured) {
    throw new Error("Demo seeding is disabled when Firebase is connected.");
  }

  return seedFreshDemoOrders();
}
