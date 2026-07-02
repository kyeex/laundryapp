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
  getFirestore,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { resolveStripeCliPath } from "./stripe-cli-path.mjs";

const execFileAsync = promisify(execFile);
const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
const qaFinalPrice = 11.11;
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

async function waitForFailure({ db, orderId, paymentIntentId }) {
  const orderRef = doc(db, "orders", orderId);
  const paymentRef = doc(db, "payments", paymentIntentId);

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const [orderSnapshot, paymentSnapshot] = await Promise.all([
      getDoc(orderRef),
      getDoc(paymentRef),
    ]);
    const order = orderSnapshot.data();
    const payment = paymentSnapshot.data();

    if (
      order?.paymentStatus === "unpaid"
      && typeof order.paymentFailureMessage === "string"
      && order.paymentFailureMessage
      && payment?.status
    ) {
      return { order, payment };
    }

    await sleep(1500);
  }

  throw new Error("Timed out waiting for Stripe payment failure effects.");
}

const env = getEnv();
const customer = createQaApp(env, `stripe-failure-qa-customer-${Date.now()}`);
const owner = createQaApp(env, `stripe-failure-qa-owner-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  await login(owner, ownerEmail);

  const qaOrderNumber = `STRIPE-FAIL-QA-${Date.now()}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `stripe-failure-qa-address-${customerId}`,
    addressSnapshot: {
      street1: "13 Stripe Failure QA Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Staging declined card QA order.",
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
    customerNotes: "Created by staging Stripe failure QA.",
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
    stripeFailureQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer can create declined-card QA order", orderRef.id));

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    finalPrice: qaFinalPrice,
    paymentStatus: "unpaid",
    status: "priced",
    updatedAt: serverTimestamp(),
  });
  results.push(pass("owner can price declined-card QA order", `$${qaFinalPrice.toFixed(2)}`));

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

  results.push(pass("backend creates PaymentIntent for declined-card test", paymentIntentId));

  const { stdout } = await execFileAsync(stripeCliPath, [
    "payment_intents",
    "confirm",
    paymentIntentId,
    "-d",
    "payment_method=pm_card_chargeDeclined",
    "--confirm",
  ]).catch((error) => {
    if (error.stdout) {
      return { stdout: error.stdout };
    }

    throw error;
  });
  const declinedPaymentIntent = JSON.parse(stdout);
  const declinedStatus =
    declinedPaymentIntent.status ??
    declinedPaymentIntent.error?.payment_intent?.status ??
    declinedPaymentIntent.payment_intent?.status;

  if (declinedStatus !== "requires_payment_method") {
    throw new Error(
      `Stripe declined-card status was ${declinedStatus}, expected requires_payment_method.`,
    );
  }

  results.push(pass("Stripe test declined card is rejected", declinedStatus));

  const effects = await waitForFailure({
    db: owner.db,
    orderId: orderRef.id,
    paymentIntentId,
  });

  results.push(pass("declined card keeps order unpaid", effects.order.paymentStatus));
  results.push(pass("declined card records failure message", effects.order.paymentFailureMessage));
  results.push(pass("declined card updates payment record", effects.payment.status));
} catch (error) {
  results.push(fail("staging Stripe failure QA completed", error?.message ?? String(error)));
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
