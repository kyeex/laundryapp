import fs from "node:fs";
import path from "node:path";
import { deleteApp, initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
const driverEmail = process.env.STAGING_DRIVER_EMAIL ?? "staging.driver@laundryapp.test";
const adminEmail = process.env.STAGING_ADMIN_EMAIL ?? "staging.admin@laundryapp.test";

function loadEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    env[trimmed.slice(0, separatorIndex)] = trimmed
      .slice(separatorIndex + 1)
      .replace(/^"|"$/g, "");
  }

  return env;
}

function getEnv() {
  const envPath = fs.existsSync(path.resolve(".env.staging"))
    ? path.resolve(".env.staging")
    : path.resolve("apps/mobile/.env.staging");
  const env = loadEnvFile(envPath);

  if (env.EXPO_PUBLIC_APP_ENV !== "staging") {
    throw new Error("Refusing to run because .env.staging is not marked as staging.");
  }

  if (env.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== "laundryapp-staging") {
    throw new Error(
      `Refusing to run against Firebase project ${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.`,
    );
  }

  return env;
}

function createQaApp(env, appName) {
  const app = initializeApp(
    {
      apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
      appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
      authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    appName,
  );

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    functions: getFunctions(app),
  };
}

async function login(context, email) {
  await signOut(context.auth).catch(() => {});
  const result = await signInWithEmailAndPassword(
    context.auth,
    email,
    seedPassword,
  );

  return result.user.uid;
}

function pass(label, detail = "") {
  return { status: "PASS", label, detail };
}

function fail(label, detail = "") {
  return { status: "FAIL", label, detail };
}

async function expectAllowed(label, action) {
  try {
    const detail = await action();
    return pass(label, detail);
  } catch (error) {
    return fail(label, error?.code ?? error?.message ?? String(error));
  }
}

async function expectBlocked(label, action) {
  try {
    await action();
    return fail(label, "unexpectedly allowed");
  } catch (error) {
    return pass(label, error?.code ?? error?.message ?? String(error));
  }
}

async function getAuditLogsByResourceId(db, resourceId) {
  const snapshot = await getDocs(
    query(collection(db, "auditLogs"), where("resourceId", "==", resourceId), limit(20)),
  );

  return snapshot.docs.map((auditDoc) => ({ id: auditDoc.id, ...auditDoc.data() }));
}

async function createAuditLog(db, log) {
  await addDoc(collection(db, "auditLogs"), {
    ...log,
    createdAt: serverTimestamp(),
  });
}

const env = getEnv();
const admin = createQaApp(env, `firebase-closure-admin-${Date.now()}`);
const customer = createQaApp(env, `firebase-closure-customer-${Date.now()}`);
const owner = createQaApp(env, `firebase-closure-owner-${Date.now()}`);
const driver = createQaApp(env, `firebase-closure-driver-${Date.now()}`);
const results = [];

try {
  const adminId = await login(admin, adminEmail);
  const customerId = await login(customer, customerEmail);
  const ownerId = await login(owner, ownerEmail);
  const driverId = await login(driver, driverEmail);

  const createManagedUser = httpsCallable(admin.functions, "createManagedUserAccount");
  const uniqueTag = Date.now();
  const createdUsers = [];

  for (const role of ["customer", "owner", "driver", "admin"]) {
    const response = await createManagedUser({
      displayName: `QA ${role} ${uniqueTag}`,
      email: `qa+${uniqueTag}-${role}@laundryapp.test`,
      phone: "555-0199",
      role,
    });
    const createdUser = response.data?.user;

    if (!createdUser?.id || createdUser.role !== role) {
      throw new Error(`Admin did not create ${role} user.`);
    }

    createdUsers.push(createdUser);
  }

  results.push(pass("admin creates customer, owner, driver, and admin users"));

  const createdUserAuditLogs = await Promise.all(
    createdUsers.map((user) => getAuditLogsByResourceId(admin.db, user.id)),
  );
  results.push(
    createdUserAuditLogs.every((logs) => logs.some((log) => log.action === "user.created"))
      ? pass("admin user creation writes audit logs")
      : fail("admin user creation writes audit logs"),
  );

  const qaOrderNumber = `FIREBASE-CLOSURE-${uniqueTag}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `firebase-closure-address-${customerId}`,
    addressSnapshot: {
      street1: "20 Firebase Closure Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Firebase staging closure QA order.",
    },
    selectedServiceIds: ["wash-fold"],
    selectedAddOns: [],
    selectedDryCleaningItems: [],
    laundryPricePerPound: 2,
    deliveryMinimumPounds: 20,
    estimatedWeightPounds: 20,
    scheduledPickupDate: "2026-07-05",
    scheduledPickupWindow: "9AM-12PM",
    scheduledDropoffDate: "2026-07-07",
    scheduledDropoffWindow: "12PM-3PM",
    status: "requested",
    customerNotes: "Created by Firebase staging closure QA.",
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
    firebaseClosureQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer creates order in staging", orderRef.id));

  results.push(
    await expectBlocked("customer cannot edit final price/status directly", () =>
      updateDoc(doc(customer.db, "orders", orderRef.id), {
        finalPrice: 1,
        status: "accepted",
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    status: "accepted",
    updatedAt: serverTimestamp(),
  });
  await createAuditLog(owner.db, {
    actorId: ownerId,
    actorRole: "owner",
    action: "order.status_changed",
    resourceType: "order",
    resourceId: orderRef.id,
    summary: "Owner accepted Firebase closure QA order.",
    metadata: {
      orderId: orderRef.id,
      status: "accepted",
    },
  });

  results.push(pass("owner accepts/manages customer order"));

  const batchRef = await addDoc(collection(owner.db, "batches"), {
    type: "pickup",
    status: "assigned",
    driverId,
    driverName: "Staging Driver",
    orderIds: [orderRef.id],
    scheduledDate: "2026-07-05",
    notes: "Firebase staging closure pickup route.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    pickupBatchId: batchRef.id,
    assignedPickupDriverId: driverId,
    status: "pickup_assigned",
    updatedAt: serverTimestamp(),
  });
  await createAuditLog(owner.db, {
    actorId: ownerId,
    actorRole: "owner",
    action: "batch.created",
    resourceType: "batch",
    resourceId: batchRef.id,
    summary: "Owner created Firebase closure pickup batch.",
    metadata: {
      orderIds: [orderRef.id],
      driverId,
    },
  });

  results.push(pass("owner creates assigned pickup batch"));

  results.push(
    await expectAllowed("driver can query assigned route", async () => {
      const snapshot = await getDocs(
        query(collection(driver.db, "batches"), where("driverId", "==", driverId)),
      );
      const match = snapshot.docs.find((batchDoc) => batchDoc.id === batchRef.id);

      if (!match) {
        throw new Error("assigned batch missing");
      }

      return batchRef.id;
    }),
  );

  results.push(
    await expectAllowed("driver can read assigned order", async () => {
      const snapshot = await getDoc(doc(driver.db, "orders", orderRef.id));

      if (!snapshot.exists()) {
        throw new Error("assigned order missing");
      }

      return snapshot.data().addressSnapshot?.street1 ?? "";
    }),
  );

  const unrelatedBatchRef = await addDoc(collection(owner.db, "batches"), {
    type: "pickup",
    status: "assigned",
    driverId: ownerId,
    driverName: "Not This Driver",
    orderIds: [],
    scheduledDate: "2026-07-06",
    notes: "Unrelated driver route for permissions check.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(
    await expectBlocked("driver cannot read unrelated route", () =>
      getDoc(doc(driver.db, "batches", unrelatedBatchRef.id)),
    ),
  );
  results.push(
    await expectBlocked("driver cannot list all orders", () =>
      getDocs(collection(driver.db, "orders")),
    ),
  );
  results.push(
    await expectBlocked("customer cannot list batches", () =>
      getDocs(collection(customer.db, "batches")),
    ),
  );
  results.push(
    await expectBlocked("customer cannot grant rewards points", () =>
      updateDoc(doc(customer.db, "loyaltyRewards", customerId), {
        pointsBalance: 999999,
      }),
    ),
  );
  results.push(
    await expectBlocked("owner cannot read admin audit logs", () =>
      getDocs(query(collection(owner.db, "auditLogs"), limit(1))),
    ),
  );

  const orderAuditLogs = await getAuditLogsByResourceId(admin.db, orderRef.id);
  const batchAuditLogs = await getAuditLogsByResourceId(admin.db, batchRef.id);
  results.push(
    orderAuditLogs.some((log) => log.action === "order.status_changed")
      && batchAuditLogs.some((log) => log.action === "batch.created")
      ? pass("admin can verify owner audit logs")
      : fail("admin can verify owner audit logs"),
  );

  const seedUsers = httpsCallable(admin.functions, "seedStagingUsers");
  const seedResponse = await seedUsers();
  results.push(
    seedResponse.data?.projectId === "laundryapp-staging"
      ? pass("staging seed tools run only against staging", seedResponse.data.projectId)
      : fail(
          "staging seed tools run only against staging",
          String(seedResponse.data?.projectId),
        ),
  );
} catch (error) {
  results.push(fail("Firebase staging closure QA completed", error?.message ?? String(error)));
} finally {
  await signOut(admin.auth).catch(() => {});
  await signOut(customer.auth).catch(() => {});
  await signOut(owner.auth).catch(() => {});
  await signOut(driver.auth).catch(() => {});
  await deleteApp(admin.app).catch(() => {});
  await deleteApp(customer.app).catch(() => {});
  await deleteApp(owner.app).catch(() => {});
  await deleteApp(driver.app).catch(() => {});
}

for (const result of results) {
  console.log(`${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`);
}

if (results.some((result) => result.status === "FAIL")) {
  process.exit(1);
}
