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
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

const orderId = process.argv[2] ?? "uWWzmoQoJP6QTo3KOPDP";
const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";
const customerEmail = process.env.STAGING_CUSTOMER_EMAIL ?? "staging.customer@laundryapp.test";
const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "staging.owner@laundryapp.test";

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

async function expectBlocked(label, action, expectedCodePart) {
  try {
    await action();
    return {
      status: "FAIL",
      label,
      detail: "unexpectedly allowed",
    };
  } catch (error) {
    const detail = error.code ?? error.message ?? String(error);
    const matched = expectedCodePart ? detail.includes(expectedCodePart) : true;

    return {
      status: matched ? "PASS" : "FAIL",
      label,
      detail,
    };
  }
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000;
  }

  return 0;
}

async function getRewardEventsForCustomer(db, customerId) {
  const snapshot = await getDocs(
    query(
      collection(db, "loyaltyRewardEvents"),
      where("customerId", "==", customerId),
    ),
  );

  return snapshot.docs
    .map((eventDoc) => ({ id: eventDoc.id, ...eventDoc.data() }))
    .sort(
      (first, second) =>
        timestampToMillis(second.createdAt) - timestampToMillis(first.createdAt),
    );
}

function getDefaultBusinessSettingsPatch(existing = {}) {
  const existingRewards = existing.loyaltyRewards ?? {};

  return {
    businessName: existing.businessName ?? "LaundryApp Staging",
    phone: existing.phone ?? "555-1000",
    serviceAreaNotes: existing.serviceAreaNotes ?? "Staging service area.",
    laundryPricePerPound: existing.laundryPricePerPound ?? 2,
    deliveryMinimumPounds: existing.deliveryMinimumPounds ?? 20,
    gratuityRateOptions: existing.gratuityRateOptions ?? [0.15, 0.2, 0.25],
    pickupAvailability: existing.pickupAvailability ?? {
      availableWeekdays: [1, 2, 3, 4, 5, 6],
      unavailableDates: [],
    },
    loyaltyRewards: {
      enabled: existingRewards.enabled ?? true,
      pointsPerDollar: existingRewards.pointsPerDollar ?? 1,
      pointsPerRewardDollar: existingRewards.pointsPerRewardDollar ?? 100,
      signupBonusPoints: existingRewards.signupBonusPoints ?? 50,
      expirationMonths: existingRewards.expirationMonths ?? null,
      tierThresholds: existingRewards.tierThresholds ?? {
        freshStart: 0,
        foldFavorite: 250,
        laundryLoyalist: 750,
      },
      tiers: existingRewards.tiers ?? [
        {
          id: "fresh-start",
          name: "Fresh Start",
          description: "Starting tier for new rewards customers.",
          minimumPoints: 0,
          color: "#ECFDF5",
          active: true,
          sortOrder: 1,
        },
      ],
    },
  };
}

const env = getEnv();
const customer = createQaApp(env, `rewards-customer-${Date.now()}`);
const owner = createQaApp(env, `rewards-owner-${Date.now()}`);
const results = [];
let originalSettings = null;
let originalSettingsExists = false;

try {
  const customerId = await login(customer, customerEmail);
  const ownerId = await login(owner, ownerEmail);
  const orderSnapshot = await getDoc(doc(owner.db, "orders", orderId));

  if (!orderSnapshot.exists()) {
    throw new Error(`Order ${orderId} does not exist in staging.`);
  }

  const order = orderSnapshot.data();

  if (order.customerId !== customerId) {
    throw new Error(
      `Order ${orderId} belongs to ${order.customerId}, not ${customerId}.`,
    );
  }

  if (order.paymentStatus !== "paid" || order.status !== "completed") {
    throw new Error(
      `Order ${orderId} must be completed and paid. Current status: ${order.status}/${order.paymentStatus}.`,
    );
  }

  const settingsRef = doc(owner.db, "settings", "business");
  const originalSettingsSnapshot = await getDoc(settingsRef);
  originalSettingsExists = originalSettingsSnapshot.exists();
  originalSettings = originalSettingsExists ? originalSettingsSnapshot.data() : null;

  const baselineSettings = getDefaultBusinessSettingsPatch(originalSettings ?? {});
  await setDoc(settingsRef, {
    ...baselineSettings,
    loyaltyRewards: {
      ...baselineSettings.loyaltyRewards,
      enabled: true,
    },
    updatedAt: new Date(),
  });

  results.push(
    await expectBlocked(
      "customer cannot call owner/admin reward-award function",
      async () => {
        await httpsCallable(
          customer.functions,
          "awardOrderRewardsForPaidOrder",
        )({ orderId });
      },
      "permission-denied",
    ),
  );

  results.push(
    await expectBlocked(
      "customer cannot directly increase own rewards balance",
      async () => {
        await updateDoc(doc(customer.db, "loyaltyRewards", customerId), {
          pointsBalance: 999999,
        });
      },
      "permission-denied",
    ),
  );

  const beforeAccountSnapshot = await getDoc(
    doc(owner.db, "loyaltyRewards", customerId),
  );
  const beforeBalance = beforeAccountSnapshot.data()?.pointsBalance ?? 0;
  const awardRewards = httpsCallable(
    owner.functions,
    "awardOrderRewardsForPaidOrder",
  );

  await awardRewards({ orderId });
  await awardRewards({ orderId });

  const afterAccountSnapshot = await getDoc(
    doc(owner.db, "loyaltyRewards", customerId),
  );
  const afterBalance = afterAccountSnapshot.data()?.pointsBalance ?? 0;
  const events = await getRewardEventsForCustomer(owner.db, customerId);
  const earnedEventsForOrder = events.filter(
    (event) => event.id === `earn-${orderId}`,
  );

  results.push({
    status:
      earnedEventsForOrder.length === 1 && afterBalance === beforeBalance
        ? "PASS"
        : "FAIL",
    label: "completed paid order awards points once",
    detail: `balance ${beforeBalance} -> ${afterBalance}; earn events: ${earnedEventsForOrder.length}`,
  });

  results.push(
    await expectBlocked(
      "redemption cannot exceed customer balance",
      async () => {
        await httpsCallable(
          customer.functions,
          "redeemRewardsForOrder",
        )({ orderId, rewardCreditDollars: 999999 });
      },
      "failed-precondition",
    ),
  );

  const latestLedgerItems = events.slice(0, 8);
  const ledgerLooksClear = latestLedgerItems.every(
    (event) =>
      typeof event.label === "string" &&
      event.label.trim() &&
      typeof event.points === "number" &&
      typeof event.type === "string" &&
      event.createdAt,
  );

  results.push({
    status: latestLedgerItems.length > 0 && ledgerLooksClear ? "PASS" : "FAIL",
    label: "rewards ledger/history is readable and clear",
    detail: latestLedgerItems
      .slice(0, 4)
      .map((event) => `${event.type}:${event.points}:${event.label}`)
      .join(" | "),
  });

  const qaTierId = `qa-tier-${Date.now()}`;
  const tierTestSettings = {
    ...baselineSettings,
    loyaltyRewards: {
      ...baselineSettings.loyaltyRewards,
      enabled: true,
      tiers: [
        ...(baselineSettings.loyaltyRewards.tiers ?? []),
        {
          id: qaTierId,
          name: "QA Tier",
          description: "Temporary rewards QA tier.",
          minimumPoints: 12345,
          color: "#CCFBF1",
          active: true,
          sortOrder: 999,
        },
      ],
    },
    updatedAt: new Date(),
  };

  await setDoc(settingsRef, tierTestSettings);
  const tierReadback = (await getDoc(settingsRef)).data();
  const tierSaved = Boolean(
    tierReadback?.loyaltyRewards?.tiers?.some(
      (tier) =>
        tier.id === qaTierId &&
        tier.name === "QA Tier" &&
        tier.minimumPoints === 12345 &&
        tier.color === "#CCFBF1",
    ),
  );

  results.push({
    status: tierSaved ? "PASS" : "FAIL",
    label: "owner tier controls can save tier name, points, and color",
    detail: tierSaved ? "temporary QA tier saved and read back" : "tier readback failed",
  });

  await setDoc(settingsRef, {
    ...tierTestSettings,
    loyaltyRewards: {
      ...tierTestSettings.loyaltyRewards,
      enabled: false,
    },
    updatedAt: new Date(),
  });
  const disabledReadback = (await getDoc(doc(customer.db, "settings", "business"))).data();
  const disabled = disabledReadback?.loyaltyRewards?.enabled === false;

  results.push({
    status: disabled ? "PASS" : "FAIL",
    label: "rewards toggle is visible to customer surfaces as disabled",
    detail: disabled
      ? "customer can read rewards enabled=false"
      : "customer did not read disabled rewards setting",
  });
} finally {
  if (originalSettingsExists && originalSettings) {
    await setDoc(doc(owner.db, "settings", "business"), originalSettings).catch(() => {});
  }

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
