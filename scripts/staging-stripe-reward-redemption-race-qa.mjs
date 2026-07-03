import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { deleteApp, initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { resolveStripeCliPath } from "./stripe-cli-path.mjs";

const execFileAsync = promisify(execFile);
const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";
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

    if (separatorIndex !== -1) {
      env[trimmed.slice(0, separatorIndex)] = trimmed
        .slice(separatorIndex + 1)
        .replace(/^"|"$/g, "");
    }
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
    throw new Error(`Refusing to run against ${env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}.`);
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
  const result = await signInWithEmailAndPassword(context.auth, email, seedPassword);

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

const env = getEnv();
const customer = createQaApp(env, `stripe-reward-race-customer-${Date.now()}`);
const owner = createQaApp(env, `stripe-reward-race-owner-${Date.now()}`);
const results = [];

try {
  const customerId = await login(customer, customerEmail);
  await login(owner, ownerEmail);

  const qaOrderNumber = `STRIPE-REWARD-RACE-QA-${Date.now()}`;
  const orderRef = await addDoc(collection(customer.db, "orders"), {
    customerId,
    customerName: "Staging Customer",
    customerPhone: "555-1001",
    orderNumber: qaOrderNumber,
    addressId: `stripe-reward-race-address-${customerId}`,
    addressSnapshot: {
      street1: "44 Reward Race QA Street",
      street2: "",
      city: "Brooklyn",
      state: "NY",
      postalCode: "11201",
      deliveryInstructions: "Staging reward redemption race QA order.",
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
    customerNotes: "Created by staging reward redemption race QA.",
    ownerNotes: "",
    driverNotes: "",
    gratuityAmount: 0,
    estimatedSubtotal: 40,
    finalPrice: null,
    paymentStatus: "unpaid",
    stripeRewardRaceQa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  results.push(pass("customer can create reward race QA order", orderRef.id));

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    finalPrice: 12.34,
    paymentStatus: "unpaid",
    status: "priced",
    updatedAt: serverTimestamp(),
  });
  results.push(pass("owner can price reward race QA order", "$12.34"));

  await setDoc(
    doc(owner.db, "loyaltyRewards", customerId),
    {
      customerId,
      customerName: "Staging Customer",
      lifetimePoints: 1000,
      pointsBalance: 1000,
      redeemedPoints: 0,
      recentActivity: [],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  results.push(pass("owner prepares customer rewards balance for redemption race"));

  const createPaymentIntent = httpsCallable(customer.functions, "createPaymentIntent");
  const response = await createPaymentIntent({
    orderId: orderRef.id,
    rewardCreditDollars: 1,
  });
  const clientSecret = response.data?.paymentIntentClientSecret;
  const [paymentIntentId] =
    typeof clientSecret === "string" ? clientSecret.split("_secret_") : [];

  if (!paymentIntentId?.startsWith("pi_")) {
    throw new Error("PaymentIntent client secret did not include a safe pi_ id.");
  }

  results.push(pass("backend creates reward-discounted PaymentIntent", paymentIntentId));

  await setDoc(
    doc(owner.db, "loyaltyRewards", customerId),
    {
      customerId,
      customerName: "Staging Customer",
      pointsBalance: 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  results.push(pass("owner removes points before Stripe confirmation to simulate race"));

  const { stdout } = await execFileAsync(stripeCliPath, [
    "payment_intents",
    "confirm",
    paymentIntentId,
    "-d",
    "payment_method=pm_card_visa",
    "--confirm",
  ]);
  const confirmedPaymentIntent = JSON.parse(stdout);

  if (confirmedPaymentIntent.status !== "succeeded") {
    throw new Error(`Stripe status is ${confirmedPaymentIntent.status}, expected succeeded.`);
  }

  results.push(pass("Stripe payment succeeds after reward balance is drained"));

  await sleep(7000);

  const [orderSnapshot, redemptionSnapshot, paymentEventsSnapshot] = await Promise.all([
    getDoc(doc(customer.db, "orders", orderRef.id)),
    getDoc(doc(owner.db, "loyaltyRewardEvents", `redeem-${orderRef.id}`)),
    getDocs(
      query(
        collection(owner.db, "orderEvents"),
        where("orderId", "==", orderRef.id),
        where("type", "==", "payment_completed"),
      ),
    ),
  ]);
  const order = orderSnapshot.data();

  results.push(
    order?.paymentStatus !== "paid"
      ? pass("order is not marked paid when reward debit fails", String(order?.paymentStatus))
      : fail("order is not marked paid when reward debit fails", "paymentStatus=paid"),
  );
  results.push(
    !redemptionSnapshot.exists()
      ? pass("failed reward debit does not write redemption event")
      : fail("failed reward debit does not write redemption event"),
  );
  results.push(
    paymentEventsSnapshot.empty
      ? pass("payment completed event is not written without reward debit")
      : fail("payment completed event is not written without reward debit"),
  );

  await updateDoc(doc(owner.db, "orders", orderRef.id), {
    securityQaCheckedAt: serverTimestamp(),
  });
} catch (error) {
  results.push(
    fail("staging reward redemption race QA completed", error?.message ?? String(error)),
  );
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
