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
const qaFinalPrice = 14.25;
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

function findUnsafeCardData(value, pathParts = []) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const unsafeNames = new Set([
    "cardNumber",
    "number",
    "cvc",
    "cvv",
    "securityCode",
    "rawCard",
    "clientSecret",
    "setupIntentClientSecret",
    "paymentIntentClientSecret",
  ]);
  const unsafeMatches = [];

  for (const [key, nestedValue] of Object.entries(value)) {
    const pathLabel = [...pathParts, key].join(".");

    if (unsafeNames.has(key)) {
      unsafeMatches.push(pathLabel);
    }

    if (
      typeof nestedValue === "string"
      && (nestedValue.includes("_secret_") || /^\d{12,19}$/.test(nestedValue))
    ) {
      unsafeMatches.push(pathLabel);
    }

    unsafeMatches.push(...findUnsafeCardData(nestedValue, [...pathParts, key]));
  }

  return unsafeMatches;
}

async function getAuditLogs(db, resourceId) {
  const snapshot = await getDocs(
    query(collection(db, "auditLogs"), where("resourceId", "==", resourceId), limit(10)),
  );

  return snapshot.docs.map((auditDoc) => ({ id: auditDoc.id, ...auditDoc.data() }));
}

const env = getEnv();
const customer = createQaApp(env, `stripe-saved-card-qa-customer-${Date.now()}`);
const owner = createQaApp(env, `stripe-saved-card-qa-owner-${Date.now()}`);
const admin = createQaApp(env, `stripe-saved-card-qa-admin-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  await login(owner, ownerEmail);
  await login(admin, adminEmail);

  const createSetupIntent = httpsCallable(
    customer.functions,
    "createOrderReviewSetupIntent",
  );
  const setupResponse = await createSetupIntent({ estimatedTotal: qaFinalPrice });
  const setupIntentId = setupResponse.data?.setupIntentId;

  if (!setupIntentId?.startsWith("seti_")) {
    throw new Error("SetupIntent did not return a safe setup id.");
  }

  results.push(pass("backend creates Stripe SetupIntent", setupIntentId));

  const { stdout } = await execFileAsync(stripeCliPath, [
    "setup_intents",
    "confirm",
    setupIntentId,
    "-d",
    "payment_method=pm_card_visa",
  ]);
  const confirmedSetupIntent = JSON.parse(stdout);

  if (confirmedSetupIntent.error) {
    throw new Error(confirmedSetupIntent.error.message ?? "Stripe setup confirmation failed.");
  }

  if (confirmedSetupIntent.status !== "succeeded") {
    throw new Error(
      `Stripe SetupIntent status is ${confirmedSetupIntent.status}, expected succeeded.`,
    );
  }

  results.push(pass("Stripe CLI confirms SetupIntent with test card", setupIntentId));

  const confirmSetupIntent = httpsCallable(
    customer.functions,
    "confirmOrderReviewSetupIntent",
  );
  const savedPaymentMethodResponse = await confirmSetupIntent({ setupIntentId });
  const savedPaymentMethod = savedPaymentMethodResponse.data ?? {};

  results.push(
    savedPaymentMethod.paymentMethodId?.startsWith("pm_")
      ? pass("backend returns safe payment method reference", savedPaymentMethod.paymentMethodId)
      : fail("backend returns safe payment method reference"),
  );

  const profileSnapshot = await getDoc(doc(customer.db, "customerProfiles", customerId));
  const profilePaymentMethod = profileSnapshot.data()?.paymentMethod ?? {};
  const unsafeProfileFields = findUnsafeCardData(profilePaymentMethod);

  results.push(
    profilePaymentMethod.stripePaymentMethodId?.startsWith("pm_")
      && profilePaymentMethod.stripeCustomerId?.startsWith("cus_")
      && profilePaymentMethod.last4 === "4242"
      ? pass("profile stores Stripe references and card summary only")
      : fail("profile stores Stripe references and card summary only"),
  );
  results.push(
    unsafeProfileFields.length === 0
      ? pass("profile stores no raw card data")
      : fail("profile stores no raw card data", unsafeProfileFields.join(", ")),
  );

  const paymentSetupSnapshot = await getDoc(doc(admin.db, "paymentSetups", setupIntentId));
  const unsafeSetupFields = findUnsafeCardData(paymentSetupSnapshot.data() ?? {});
  results.push(
    unsafeSetupFields.length === 0
      ? pass("payment setup record stores no client secret or raw card data")
      : fail(
          "payment setup record stores no client secret or raw card data",
          unsafeSetupFields.join(", "),
        ),
  );

  const qaOrderNumber = `STRIPE-SAVED-QA-${Date.now()}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `stripe-saved-qa-address-${customerId}`,
    addressSnapshot: {
      street1: "12 Stripe Saved Card QA Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Staging saved card QA order.",
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
    customerNotes: "Created by staging Stripe saved payment method QA.",
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
    stripeSavedPaymentQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer can create saved-card QA order", orderRef.id));

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    finalPrice: qaFinalPrice,
    paymentStatus: "unpaid",
    status: "priced",
    updatedAt: serverTimestamp(),
  });
  results.push(pass("owner can price saved-card QA order", `$${qaFinalPrice.toFixed(2)}`));

  const chargeSavedPayment = httpsCallable(
    customer.functions,
    "chargeOrderSavedPaymentMethod",
  );
  const chargeResponse = await chargeSavedPayment({
    orderId: orderRef.id,
    rewardCreditDollars: 0,
  });

  results.push(
    chargeResponse.data?.status === "paid"
      ? pass("customer pays with saved Stripe card", chargeResponse.data.status)
      : fail("customer pays with saved Stripe card", String(chargeResponse.data?.status)),
  );

  const paidOrderSnapshot = await getDoc(doc(customer.db, "orders", orderRef.id));
  const paidOrder = paidOrderSnapshot.data() ?? {};
  const paymentId = paidOrder.paymentId;

  results.push(
    paidOrder.paymentStatus === "paid"
      ? pass("saved-card payment marks order paid")
      : fail("saved-card payment marks order paid", String(paidOrder.paymentStatus)),
  );
  results.push(
    typeof paymentId === "string" && paymentId.startsWith("pi_") && !paymentId.includes("_secret_")
      ? pass("order stores safe PaymentIntent id after saved-card charge", paymentId)
      : fail("order stores safe PaymentIntent id after saved-card charge"),
  );

  const duplicateResponse = await chargeSavedPayment({
    orderId: orderRef.id,
    rewardCreditDollars: 0,
  });
  results.push(
    duplicateResponse.data?.status === "paid"
      ? pass("duplicate saved-card payment attempt is idempotently blocked")
      : fail(
          "duplicate saved-card payment attempt is idempotently blocked",
          String(duplicateResponse.data?.status),
        ),
  );

  const paymentSnapshot = await getDoc(doc(owner.db, "payments", paymentId));
  const rewardSnapshot = await getDoc(doc(admin.db, "loyaltyRewardEvents", `earn-${orderRef.id}`));
  const setupAuditLogs = await getAuditLogs(admin.db, setupIntentId);
  const paymentAuditLogs = await getAuditLogs(admin.db, paymentId);

  results.push(
    paymentSnapshot.data()?.status === "succeeded"
      ? pass("saved-card payment record writes succeeded status")
      : fail("saved-card payment record writes succeeded status"),
  );
  results.push(
    setupAuditLogs.some((log) => log.action === "payment.method_saved")
      ? pass("saving payment method writes audit log")
      : fail("saving payment method writes audit log"),
  );
  results.push(
    paymentAuditLogs.some((log) => log.action === "payment.completed")
      ? pass("saved-card payment writes audit log")
      : fail("saved-card payment writes audit log"),
  );
  results.push(
    rewardSnapshot.exists()
      ? pass("saved-card payment awards rewards once", `${rewardSnapshot.data().points} point(s)`)
      : fail("saved-card payment awards rewards once"),
  );
} catch (error) {
  results.push(fail("staging saved payment method QA completed", error?.message ?? String(error)));
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
