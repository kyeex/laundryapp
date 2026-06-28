import fs from "node:fs";
import path from "node:path";
import { deleteApp, initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
const driverEmail = process.env.STAGING_DRIVER_EMAIL ?? "staging.driver@laundryapp.test";
const adminEmail = process.env.STAGING_ADMIN_EMAIL ?? "staging.admin@laundryapp.test";

const defaultNotificationPreferences = {
  customerOrderUpdates: true,
  ownerNewRequests: true,
  ownerPaymentUpdates: true,
  driverAssignedRoutes: true,
  rewardsUpdates: true,
};

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

function errorDetail(error) {
  return error?.code ?? error?.message ?? String(error);
}

async function expectBlocked(label, action, expectedCodePart) {
  try {
    await action();
    return fail(label, "unexpectedly allowed");
  } catch (error) {
    const detail = errorDetail(error);

    return !expectedCodePart || detail.includes(expectedCodePart)
      ? pass(label, detail)
      : fail(label, detail);
  }
}

function notificationPreferenceForEvent(eventType) {
  if (eventType === "order_created") {
    return "ownerNewRequests";
  }

  if (eventType === "payment_completed") {
    return "ownerPaymentUpdates";
  }

  if (eventType === "batch_assigned") {
    return "driverAssignedRoutes";
  }

  return "customerOrderUpdates";
}

async function getUserByEmail(db, email) {
  const snapshot = await getDocs(
    query(collection(db, "users"), where("email", "==", email), limit(1)),
  );

  if (snapshot.empty) {
    throw new Error(`Missing staging user ${email}.`);
  }

  const userDoc = snapshot.docs[0];

  return { id: userDoc.id, ...userDoc.data() };
}

async function getRecentOrderEvents(db, maxCount = 250) {
  const snapshot = await getDocs(
    query(collection(db, "orderEvents"), orderBy("createdAt", "desc"), limit(maxCount)),
  );

  return snapshot.docs.map((eventDoc) => ({
    id: eventDoc.id,
    ...eventDoc.data(),
  }));
}

async function getLatestEvent(events, type) {
  return events.find((event) => event.type === type) ?? null;
}

function getRecipientsForEvent(event, order, ownerIds) {
  if (event.type === "order_created" || event.type === "payment_completed") {
    return ownerIds;
  }

  if (event.type === "batch_assigned") {
    const driverId =
      event.toStatus === "delivery_assigned"
        ? order.assignedDeliveryDriverId
        : order.assignedPickupDriverId;

    return driverId ? [driverId] : [];
  }

  return order.customerId ? [order.customerId] : [];
}

const env = getEnv();
const customer = createQaApp(env, `notifications-customer-${Date.now()}`);
const owner = createQaApp(env, `notifications-owner-${Date.now()}`);
const driver = createQaApp(env, `notifications-driver-${Date.now()}`);
const admin = createQaApp(env, `notifications-admin-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  const ownerId = await login(owner, ownerEmail);
  const driverId = await login(driver, driverEmail);
  await login(admin, adminEmail);

  const customerUserRef = doc(customer.db, "users", customerId);
  const originalCustomer = (await getDoc(customerUserRef)).data();
  const originalCustomerPreferences = {
    ...defaultNotificationPreferences,
    ...(originalCustomer?.notificationPreferences ?? {}),
  };

  try {
    await updateDoc(customerUserRef, {
      notificationPreferences: {
        ...originalCustomerPreferences,
        customerOrderUpdates: !originalCustomerPreferences.customerOrderUpdates,
      },
      updatedAt: serverTimestamp(),
    });
    const toggledCustomer = (await getDoc(customerUserRef)).data();
    const toggledValue =
      toggledCustomer?.notificationPreferences?.customerOrderUpdates ===
      !originalCustomerPreferences.customerOrderUpdates;

    results.push(
      toggledValue
        ? pass("customer can update own notification preference")
        : fail("customer can update own notification preference", "readback mismatch"),
    );
  } catch (error) {
    results.push(
      fail("customer can update own notification preference", errorDetail(error)),
    );
  }

  try {
    await updateDoc(customerUserRef, {
      notificationPreferences: originalCustomerPreferences,
      updatedAt: serverTimestamp(),
    });
    results.push(pass("customer notification preferences can be restored"));
  } catch (error) {
    results.push(
      fail("customer notification preferences can be restored", errorDetail(error)),
    );
  }

  results.push(
    await expectBlocked(
      "customer cannot change role while saving notification preferences",
      async () => {
        await updateDoc(customerUserRef, {
          notificationPreferences: originalCustomerPreferences,
          role: "admin",
          updatedAt: serverTimestamp(),
        });
      },
      "permission-denied",
    ),
  );

  const ownerUser = await getUserByEmail(admin.db, ownerEmail);
  const driverUser = await getUserByEmail(admin.db, driverEmail);
  const customerUser = await getUserByEmail(admin.db, customerEmail);

  for (const [label, user] of [
    ["customer", customerUser],
    ["owner", ownerUser],
    ["driver", driverUser],
  ]) {
    const preferences = {
      ...defaultNotificationPreferences,
      ...(user.notificationPreferences ?? {}),
    };
    const requiredKeys =
      label === "customer"
        ? ["customerOrderUpdates", "rewardsUpdates"]
        : label === "owner"
          ? ["ownerNewRequests", "ownerPaymentUpdates"]
          : ["driverAssignedRoutes"];
    const hasKeys = requiredKeys.every((key) => typeof preferences[key] === "boolean");

    results.push(
      hasKeys
        ? pass(`${label} has role-appropriate notification preferences`)
        : fail(`${label} has role-appropriate notification preferences`),
    );
  }

  let ownerIds = [];
  try {
    const activeOwnerSnapshot = await getDocs(
      query(
        collection(admin.db, "users"),
        where("role", "==", "owner"),
        where("active", "==", true),
      ),
    );
    ownerIds = activeOwnerSnapshot.docs.map((ownerDoc) => ownerDoc.id);
    results.push(pass("admin can read active owner notification recipients"));
  } catch (error) {
    results.push(
      fail("admin can read active owner notification recipients", errorDetail(error)),
    );
  }

  let events = [];
  try {
    events = await getRecentOrderEvents(owner.db);
    results.push(pass("owner can read recent order notification events"));
  } catch (error) {
    results.push(
      fail("owner can read recent order notification events", errorDetail(error)),
    );
  }

  const eventTypes = [
    "order_created",
    "status_changed",
    "price_set",
    "payment_completed",
    "batch_assigned",
    "driver_status_changed",
  ];

  for (const eventType of eventTypes) {
    const event = await getLatestEvent(events, eventType);

    if (!event?.orderId) {
      results.push(fail(`recent ${eventType} order event exists`));
      continue;
    }

    let orderSnapshot;
    try {
      orderSnapshot = await getDoc(doc(owner.db, "orders", event.orderId));
    } catch (error) {
      results.push(
        fail(`recent ${eventType} references a readable order`, errorDetail(error)),
      );
      continue;
    }

    if (!orderSnapshot.exists()) {
      results.push(fail(`recent ${eventType} references an existing order`));
      continue;
    }

    const order = orderSnapshot.data();
    const recipients = getRecipientsForEvent(event, order, ownerIds);
    const preference = notificationPreferenceForEvent(event.type);

    results.push(
      recipients.length > 0
        ? pass(
            `${eventType} routes to recipient(s)`,
            `${recipients.join(", ")} via ${preference}`,
          )
        : fail(`${eventType} routes to recipient(s)`, "no recipients"),
    );
  }

  results.push(
    ownerIds.includes(ownerId)
      ? pass("owner new request notifications target active owners")
      : fail("owner new request notifications target active owners"),
  );

  results.push(
    driverUser.id === driverId
      ? pass("driver assigned route notifications target staging driver profile")
      : fail("driver assigned route notifications target staging driver profile"),
  );
} catch (error) {
  results.push(fail("staging notifications QA completed", errorDetail(error)));
} finally {
  await signOut(customer.auth).catch(() => {});
  await signOut(owner.auth).catch(() => {});
  await signOut(driver.auth).catch(() => {});
  await signOut(admin.auth).catch(() => {});
  await deleteApp(customer.app).catch(() => {});
  await deleteApp(owner.app).catch(() => {});
  await deleteApp(driver.app).catch(() => {});
  await deleteApp(admin.app).catch(() => {});
}

for (const result of results) {
  console.log(`${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`);
}

if (results.some((result) => result.status === "FAIL")) {
  process.exit(1);
}
