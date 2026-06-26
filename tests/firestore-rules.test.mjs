import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const projectId = "laundryapp-rules-test";
const rules = fs.readFileSync(path.join(rootDir, "firestore.rules"), "utf8");

const userProfiles = {
  customer: {
    id: "customer-1",
    email: "customer@example.test",
    role: "customer",
    displayName: "Customer One",
    phone: "555-0001",
    active: true,
  },
  otherCustomer: {
    id: "customer-2",
    email: "other@example.test",
    role: "customer",
    displayName: "Customer Two",
    phone: "555-0002",
    active: true,
  },
  owner: {
    id: "owner-1",
    email: "owner@example.test",
    role: "owner",
    displayName: "Owner One",
    phone: "555-0003",
    active: true,
  },
  driver: {
    id: "driver-1",
    email: "driver@example.test",
    role: "driver",
    displayName: "Driver One",
    phone: "555-0004",
    active: true,
  },
  otherDriver: {
    id: "driver-2",
    email: "driver2@example.test",
    role: "driver",
    displayName: "Driver Two",
    phone: "555-0005",
    active: true,
  },
  admin: {
    id: "admin-1",
    email: "admin@example.test",
    role: "admin",
    displayName: "Admin One",
    phone: "555-0006",
    active: true,
  },
};

const baseOrder = {
  customerId: userProfiles.customer.id,
  customerName: userProfiles.customer.displayName,
  customerPhone: userProfiles.customer.phone,
  addressId: "address-1",
  addressSnapshot: {
    label: "Home",
    street1: "1 Test Street",
    street2: "",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    deliveryInstructions: "",
  },
  selectedServiceIds: ["wash-fold"],
  selectedAddOns: [],
  selectedDryCleaningItems: [],
  laundryPricePerPound: 2,
  deliveryMinimumPounds: 20,
  estimatedWeightPounds: 20,
  scheduledPickupDate: "2026-06-26",
  scheduledPickupWindow: "9:00 AM - 12:00 PM",
  scheduledDropoffDate: "2026-06-28",
  scheduledDropoffWindow: "12:00 PM - 3:00 PM",
  status: "requested",
  customerNotes: "",
  ownerNotes: "",
  driverNotes: "",
  gratuityAmount: 0,
  estimatedSubtotal: 40,
  finalPrice: null,
  paymentStatus: "unpaid",
  pickupBatchId: null,
  deliveryBatchId: null,
  assignedPickupDriverId: null,
  assignedDeliveryDriverId: null,
};

function contextDb(testEnv, user) {
  return testEnv.authenticatedContext(user.id, { email: user.email }).firestore();
}

async function seedFirestore(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await Promise.all(
      Object.values(userProfiles).map((user) =>
        setDoc(doc(db, "users", user.id), user),
      ),
    );

    await setDoc(doc(db, "customerProfiles", userProfiles.customer.id), {
      userId: userProfiles.customer.id,
      defaultAddressId: "customer-1-default",
      notes: "",
    });
    await setDoc(doc(db, "driverProfiles", userProfiles.driver.id), {
      userId: userProfiles.driver.id,
      active: true,
      phone: userProfiles.driver.phone,
      vehicleInfo: "Test van",
    });
    await setDoc(doc(db, "addresses", "customer-1-default"), {
      userId: userProfiles.customer.id,
      street1: "1 Test Street",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
    });
    await setDoc(doc(db, "orders", "order-customer-1"), {
      ...baseOrder,
      status: "requested",
    });
    await setDoc(doc(db, "orders", "order-assigned-driver"), {
      ...baseOrder,
      status: "pickup_assigned",
      pickupBatchId: "batch-driver-1",
      assignedPickupDriverId: userProfiles.driver.id,
    });
    await setDoc(doc(db, "orders", "order-other-driver"), {
      ...baseOrder,
      customerId: userProfiles.otherCustomer.id,
      status: "pickup_assigned",
      pickupBatchId: "batch-driver-2",
      assignedPickupDriverId: userProfiles.otherDriver.id,
    });
    await setDoc(doc(db, "batches", "batch-driver-1"), {
      type: "pickup",
      status: "assigned",
      driverId: userProfiles.driver.id,
      driverName: userProfiles.driver.displayName,
      orderIds: ["order-assigned-driver"],
      scheduledDate: "2026-06-26",
      notes: "",
    });
    await setDoc(doc(db, "batches", "batch-driver-2"), {
      type: "pickup",
      status: "assigned",
      driverId: userProfiles.otherDriver.id,
      driverName: userProfiles.otherDriver.displayName,
      orderIds: ["order-other-driver"],
      scheduledDate: "2026-06-26",
      notes: "",
    });
    await setDoc(doc(db, "loyaltyRewards", userProfiles.customer.id), {
      customerId: userProfiles.customer.id,
      customerName: userProfiles.customer.displayName,
      pointsBalance: 100,
      lifetimePoints: 100,
      redeemedPoints: 0,
      recentActivity: [],
    });
    await setDoc(doc(db, "auditLogs", "audit-1"), {
      actorId: userProfiles.owner.id,
      actorRole: "owner",
      action: "order.status_changed",
      resourceType: "order",
      resourceId: "order-customer-1",
      summary: "Owner changed status.",
      metadata: {},
    });
  });
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    throw error;
  }
}

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });

  try {
    await testEnv.clearFirestore();
    await seedFirestore(testEnv);

    const customerDb = contextDb(testEnv, userProfiles.customer);
    const ownerDb = contextDb(testEnv, userProfiles.owner);
    const driverDb = contextDb(testEnv, userProfiles.driver);
    const adminDb = contextDb(testEnv, userProfiles.admin);

    await runTest("customer can read and update own profile", async () => {
      await assertSucceeds(getDoc(doc(customerDb, "customerProfiles", "customer-1")));
      await assertSucceeds(
        updateDoc(doc(customerDb, "users", "customer-1"), {
          phone: "555-1111",
          updatedAt: "test",
        }),
      );
    });

    await runTest("customer can create own order request", async () => {
      await assertSucceeds(
        addDoc(collection(customerDb, "orders"), {
          ...baseOrder,
          customerId: "customer-1",
          status: "requested",
          paymentStatus: "unpaid",
          finalPrice: null,
        }),
      );
    });

    await runTest("customer cannot edit status or final price directly", async () => {
      await assertFails(
        updateDoc(doc(customerDb, "orders", "order-customer-1"), {
          status: "accepted",
          updatedAt: "test",
        }),
      );
      await assertFails(
        updateDoc(doc(customerDb, "orders", "order-customer-1"), {
          finalPrice: 1,
          updatedAt: "test",
        }),
      );
    });

    await runTest("customer can read own rewards but cannot grant points", async () => {
      await assertSucceeds(getDoc(doc(customerDb, "loyaltyRewards", "customer-1")));
      await assertFails(
        updateDoc(doc(customerDb, "loyaltyRewards", "customer-1"), {
          pointsBalance: 100000,
        }),
      );
      await assertFails(
        setDoc(doc(customerDb, "loyaltyRewardEvents", "customer-grant"), {
          customerId: "customer-1",
          customerName: "Customer One",
          points: 100000,
          type: "earned",
        }),
      );
    });

    await runTest("owner can manage orders, batches, catalog, and rewards", async () => {
      await assertSucceeds(
        updateDoc(doc(ownerDb, "orders", "order-customer-1"), {
          status: "accepted",
          updatedAt: "test",
        }),
      );
      await assertSucceeds(
        setDoc(doc(ownerDb, "batches", "batch-owner-created"), {
          type: "pickup",
          status: "assigned",
          driverId: "driver-1",
          driverName: "Driver One",
          orderIds: ["order-customer-1"],
          scheduledDate: "2026-06-26",
          notes: "",
        }),
      );
      await assertSucceeds(
        setDoc(doc(ownerDb, "settings", "business"), {
          businessName: "Test Laundry",
          laundryPricePerPound: 2,
          deliveryMinimumPounds: 20,
        }),
      );
      await assertSucceeds(
        updateDoc(doc(ownerDb, "loyaltyRewards", "customer-1"), {
          pointsBalance: 125,
        }),
      );
    });

    await runTest("owner cannot access admin-only user tools or audit logs", async () => {
      await assertFails(getDoc(doc(ownerDb, "users", "admin-1")));
      await assertFails(getDoc(doc(ownerDb, "auditLogs", "audit-1")));
    });

    await runTest("driver can read assigned batch and update assigned stop", async () => {
      await assertSucceeds(getDoc(doc(driverDb, "batches", "batch-driver-1")));
      await assertSucceeds(
        updateDoc(doc(driverDb, "orders", "order-assigned-driver"), {
          status: "picked_up",
          updatedAt: "test",
        }),
      );
      await assertSucceeds(
        updateDoc(doc(driverDb, "batches", "batch-driver-1"), {
          status: "completed",
          updatedAt: "test",
        }),
      );
    });

    await runTest("driver cannot see unrelated customer orders or batches", async () => {
      await assertFails(getDoc(doc(driverDb, "orders", "order-other-driver")));
      await assertFails(getDoc(doc(driverDb, "batches", "batch-driver-2")));
    });

    await runTest("admin can manage users, rewards, and view audit logs", async () => {
      await assertSucceeds(
        setDoc(doc(adminDb, "users", "owner-2"), {
          email: "owner2@example.test",
          role: "owner",
          displayName: "Owner Two",
          phone: "555-2000",
          active: true,
        }),
      );
      await assertSucceeds(getDoc(doc(adminDb, "auditLogs", "audit-1")));
      await assertSucceeds(
        updateDoc(doc(adminDb, "loyaltyRewards", "customer-1"), {
          pointsBalance: 150,
        }),
      );
    });

    await runTest("blocked access checks for direct-route style reads", async () => {
      await assertFails(getDoc(doc(customerDb, "settings", "adminOnly")));
      await assertFails(getDocs(query(collection(driverDb, "orders"), where("customerId", "==", "customer-1"))));
      await assertFails(deleteDoc(doc(customerDb, "orders", "order-customer-1")));
    });
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(() => {
  process.exitCode = 1;
});
