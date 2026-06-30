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
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
const qaFinalPrice = 12.34;

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

function redactClientSecret(value) {
  if (typeof value !== "string") {
    return "";
  }

  const [paymentIntentId] = value.split("_secret_");
  return `${paymentIntentId}_secret_[redacted]`;
}

const env = getEnv();
const customer = createQaApp(env, `stripe-qa-customer-${Date.now()}`);
const owner = createQaApp(env, `stripe-qa-owner-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  await login(owner, ownerEmail);

  const qaOrderNumber = `STRIPE-QA-${Date.now()}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `stripe-qa-address-${customerId}`,
    addressSnapshot: {
      street1: "10 Stripe QA Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Staging payment intent QA order.",
    },
    selectedServiceIds: ["wash-fold"],
    selectedAddOns: [],
    selectedDryCleaningItems: [],
    laundryPricePerPound: 2,
    deliveryMinimumPounds: 20,
    estimatedWeightPounds: 20,
    scheduledPickupDate: "2026-07-01",
    scheduledPickupWindow: "9AM-12PM",
    scheduledDropoffDate: "2026-07-03",
    scheduledDropoffWindow: "12PM-3PM",
    status: "requested",
    customerNotes: "Created by staging Stripe PaymentIntent QA.",
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
    stripeQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer can create staging Stripe QA order", orderRef.id));

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    finalPrice: qaFinalPrice,
    paymentStatus: "unpaid",
    status: "priced",
    updatedAt: serverTimestamp(),
  });
  results.push(pass("owner can price Stripe QA order", `$${qaFinalPrice.toFixed(2)}`));

  const createPaymentIntent = httpsCallable(customer.functions, "createPaymentIntent");
  const response = await createPaymentIntent({
    orderId: orderRef.id,
    rewardCreditDollars: 0,
  });
  const data = response.data ?? {};
  const responseKeys = Object.keys(data).sort();
  const clientSecret = data.paymentIntentClientSecret;

  if (
    responseKeys.length === 1
    && responseKeys[0] === "paymentIntentClientSecret"
    && typeof clientSecret === "string"
    && clientSecret.includes("_secret_")
  ) {
    results.push(
      pass("backend returns only PaymentIntent client secret", redactClientSecret(clientSecret)),
    );
  } else {
    results.push(
      fail("backend returns only PaymentIntent client secret", responseKeys.join(", ")),
    );
  }

  const updatedOrder = (await getDoc(doc(customer.db, "orders", orderRef.id))).data();
  const paymentId = updatedOrder?.paymentId;
  const storedUnsafeSecret =
    typeof paymentId === "string" && paymentId.includes("_secret_");

  results.push(
    updatedOrder?.paymentStatus === "pending"
      ? pass("order becomes paymentStatus pending")
      : fail("order becomes paymentStatus pending", String(updatedOrder?.paymentStatus)),
  );
  results.push(
    typeof paymentId === "string" && paymentId.startsWith("pi_") && !storedUnsafeSecret
      ? pass("order stores safe Stripe PaymentIntent id", paymentId)
      : fail("order stores safe Stripe PaymentIntent id"),
  );
  results.push(
    updatedOrder?.paymentAmountDue === qaFinalPrice
      ? pass("backend-calculated amount due is saved", `$${updatedOrder.paymentAmountDue}`)
      : fail("backend-calculated amount due is saved", String(updatedOrder?.paymentAmountDue)),
  );
} catch (error) {
  results.push(fail("staging Stripe PaymentIntent QA completed", error?.message ?? String(error)));
} finally {
  await signOut(customer.auth).catch(() => {});
  await signOut(owner.auth).catch(() => {});
  await deleteApp(customer.app).catch(() => {});
  await deleteApp(owner.app).catch(() => {});
}

for (const result of results) {
  console.log(`${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`);
}

if (results.some((result) => result.status === "FAIL")) {
  process.exit(1);
}
