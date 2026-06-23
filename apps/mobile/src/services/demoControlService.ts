import { shouldUseDemoBackend } from "@/config/firebase";
import { resetDemoOrders, seedFreshDemoOrders } from "@/data/demoStore";
import { resetDemoManagedUsers } from "@/services/adminUserService";

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
