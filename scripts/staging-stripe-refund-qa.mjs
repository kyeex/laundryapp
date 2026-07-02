import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
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
import { resolveStripeCliPath } from "./stripe-cli-path.mjs";

const execFileAsync = promisify(execFile);
const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
const adminEmail = process.env.STAGING_ADMIN_EMAIL ?? "staging.admin@laundryapp.test";
const qaFinalPrice = 12.89;
const stripeCliPath = resolveStripeCliPath();

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

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAuditLogsByResourceId(db, resourceId) {
  const snapshot = await getDocs(
    query(collection(db, "auditLogs"), where("resourceId", "==", resourceId), limit(10)),
  );

  return snapshot.docs.map((auditDoc) => ({ id: auditDoc.id, ...auditDoc.data() }));
}

async function waitForPaidEffects({ adminDb, customerDb, ownerDb, orderId, paymentIntentId }) {
  const orderRef = doc(customerDb, "orders", orderId);
  const paymentRef = doc(ownerDb, "payments", paymentIntentId);
  const eventRef = doc(ownerDb, "orderEvents", `payment-${paymentIntentId}-completed`);
  const rewardEventRef = doc(adminDb, "loyaltyRewardEvents", `earn-${orderId}`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const [orderSnapshot, paymentSnapshot, eventSnapshot, rewardSnapshot, auditLogs] =
      await Promise.all([
        getDoc(orderRef),
        getDoc(paymentRef),
        getDoc(eventRef),
        getDoc(rewardEventRef),
        getAuditLogsByResourceId(adminDb, paymentIntentId),
      ]);
    const order = orderSnapshot.data();
    const payment = paymentSnapshot.data();
    const hasPaymentAudit = auditLogs.some((log) => log.action === "payment.completed");

    if (
      order?.paymentStatus === "paid"
      && payment?.status === "succeeded"
      && eventSnapshot.exists()
      && rewardSnapshot.exists()
      && hasPaymentAudit
    ) {
      return { order, payment };
    }

    await sleep(2000);
  }

  throw new Error("Timed out waiting for paid webhook effects.");
}

async function waitForRefundEffects({ adminDb, customerDb, ownerDb, orderId, paymentIntentId }) {
  const orderRef = doc(customerDb, "orders", orderId);
  const paymentRef = doc(ownerDb, "payments", paymentIntentId);
  const eventRef = doc(ownerDb, "orderEvents", `payment-${paymentIntentId}-refunded`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const [orderSnapshot, paymentSnapshot, eventSnapshot, auditLogs] = await Promise.all([
      getDoc(orderRef),
      getDoc(paymentRef),
      getDoc(eventRef),
      getAuditLogsByResourceId(adminDb, paymentIntentId),
    ]);
    const order = orderSnapshot.data();
    const payment = paymentSnapshot.data();
    const hasRequestedAudit = auditLogs.some(
      (log) => log.action === "payment.refund_requested",
    );
    const hasRefundAudit = auditLogs.some((log) => log.action === "payment.refunded");

    if (
      order?.paymentStatus === "refunded"
      && payment?.status === "refunded"
      && eventSnapshot.exists()
      && hasRequestedAudit
      && hasRefundAudit
    ) {
      return {
        auditLogs,
        event: eventSnapshot.data(),
        order,
        payment,
      };
    }

    await sleep(2000);
  }

  throw new Error("Timed out waiting for Stripe refund webhook effects.");
}

const env = getEnv();
const customer = createQaApp(env, `stripe-refund-qa-customer-${Date.now()}`);
const owner = createQaApp(env, `stripe-refund-qa-owner-${Date.now()}`);
const admin = createQaApp(env, `stripe-refund-qa-admin-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  await login(owner, ownerEmail);
  await login(admin, adminEmail);

  const qaOrderNumber = `STRIPE-REFUND-QA-${Date.now()}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `stripe-refund-qa-address-${customerId}`,
    addressSnapshot: {
      street1: "22 Stripe Refund QA Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Staging refund QA order.",
    },
    selectedServiceIds: ["wash-fold"],
    selectedAddOns: [],
    selectedDryCleaningItems: [],
    laundryPricePerPound: 2,
    deliveryMinimumPounds: 20,
    estimatedWeightPounds: 20,
    scheduledPickupDate: "2026-07-02",
    scheduledPickupWindow: "9AM-12PM",
    scheduledDropoffDate: "2026-07-04",
    scheduledDropoffWindow: "12PM-3PM",
    status: "requested",
    customerNotes: "Created by staging Stripe refund QA.",
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
    stripeRefundQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer can create staging refund QA order", orderRef.id));

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    finalPrice: qaFinalPrice,
    paymentStatus: "unpaid",
    status: "priced",
    updatedAt: serverTimestamp(),
  });
  results.push(pass("owner can price refund QA order", `$${qaFinalPrice.toFixed(2)}`));

  const createPaymentIntent = httpsCallable(customer.functions, "createPaymentIntent");
  const response = await createPaymentIntent({
    orderId: orderRef.id,
    rewardCreditDollars: 0,
  });
  const clientSecret = response.data?.paymentIntentClientSecret;
  const [paymentIntentId] =
    typeof clientSecret === "string" ? clientSecret.split("_secret_") : [];

  if (!paymentIntentId?.startsWith("pi_")) {
    throw new Error("PaymentIntent client secret did not include a safe pi_ id.");
  }

  results.push(pass("backend creates refundable PaymentIntent", paymentIntentId));

  const { stdout } = await execFileAsync(stripeCliPath, [
    "payment_intents",
    "confirm",
    paymentIntentId,
    "-d",
    "payment_method=pm_card_visa",
    "--confirm",
  ]);
  const confirmedPaymentIntent = JSON.parse(stdout);

  if (confirmedPaymentIntent.error) {
    throw new Error(confirmedPaymentIntent.error.message ?? "Stripe CLI returned an error.");
  }

  if (confirmedPaymentIntent.status !== "succeeded") {
    throw new Error(
      `Stripe PaymentIntent status is ${confirmedPaymentIntent.status}, expected succeeded.`,
    );
  }

  results.push(pass("Stripe CLI confirms refundable payment", paymentIntentId));

  await waitForPaidEffects({
    adminDb: admin.db,
    customerDb: customer.db,
    ownerDb: owner.db,
    orderId: orderRef.id,
    paymentIntentId,
  });
  results.push(pass("payment is paid before refund request"));

  const refundOrderPayment = httpsCallable(owner.functions, "refundOrderPayment");
  const refundResponse = await refundOrderPayment({
    orderId: orderRef.id,
    reason: "QA refund webhook verification.",
  });
  const refundId = refundResponse.data?.refundId;

  if (!refundId?.startsWith("re_")) {
    throw new Error("Refund callable did not return a Stripe refund id.");
  }

  results.push(pass("owner can request refund through backend", refundId));

  const effects = await waitForRefundEffects({
    adminDb: admin.db,
    customerDb: customer.db,
    ownerDb: owner.db,
    orderId: orderRef.id,
    paymentIntentId,
  });

  results.push(pass("refund webhook marks order refunded", effects.order.paymentStatus));
  results.push(pass("refund webhook updates payment record", effects.payment.status));
  results.push(pass("refund webhook writes order event", effects.event.type));
  results.push(pass("refund request and refund audit logs are visible"));
} catch (error) {
  results.push(fail("staging Stripe refund QA completed", error?.message ?? String(error)));
} finally {
  await signOut(customer.auth).catch(() => {});
  await signOut(owner.auth).catch(() => {});
  await signOut(admin.auth).catch(() => {});
  await deleteApp(customer.app).catch(() => {});
  await deleteApp(owner.app).catch(() => {});
  await deleteApp(admin.app).catch(() => {});
}

for (const result of results) {
  console.log(`${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`);
}

if (results.some((result) => result.status === "FAIL")) {
  process.exit(1);
}
