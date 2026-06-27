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
} from "firebase/firestore";

const orderId = process.argv[2];

if (!orderId) {
  console.error("Usage: node scripts/staging-role-qa.mjs <orderId>");
  process.exit(1);
}

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

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed
      .slice(separatorIndex + 1)
      .replace(/^"|"$/g, "");

    env[key] = value;
  }

  return env;
}

const envPath = fs.existsSync(path.resolve(".env.staging"))
  ? path.resolve(".env.staging")
  : path.resolve("apps/mobile/.env.staging");
const env = loadEnvFile(envPath);
const seedPassword = process.env.STAGING_SEED_PASSWORD ?? "LaundryDemo#2026!";

if (env.EXPO_PUBLIC_APP_ENV !== "staging") {
  console.error("Refusing to run because .env.staging is not marked as staging.");
  process.exit(1);
}

const app = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const auth = getAuth(app);
const db = getFirestore(app);
const results = [];

async function login(email) {
  await signOut(auth).catch(() => {});
  const result = await signInWithEmailAndPassword(auth, email, seedPassword);

  return result.user.uid;
}

async function mustPass(label, action) {
  try {
    const result = await action();
    results.push({ status: "PASS", label, detail: result ?? "" });
  } catch (error) {
    results.push({
      status: "FAIL",
      label,
      detail: error.code ?? error.message ?? String(error),
    });
  }
}

async function mustBlock(label, action) {
  try {
    await action();
    results.push({ status: "FAIL", label, detail: "unexpectedly allowed" });
  } catch (error) {
    results.push({
      status: "PASS",
      label,
      detail: error.code ?? error.message ?? String(error),
    });
  }
}

try {
  await login("staging.customer@laundryapp.test");
  await mustPass("customer can read own completed order", async () => {
    const snapshot = await getDoc(doc(db, "orders", orderId));

    if (!snapshot.exists()) {
      throw new Error("missing order");
    }

    const data = snapshot.data();

    if (data.status !== "completed") {
      throw new Error(`expected completed, got ${data.status}`);
    }

    return [
      data.orderNumber,
      data.status,
      data.customerPhone,
      data.addressSnapshot?.street1,
    ]
      .filter(Boolean)
      .join(" | ");
  });
  await mustBlock("customer cannot list batches", () =>
    getDocs(collection(db, "batches")),
  );

  await login("staging.driver@laundryapp.test");
  await mustPass("driver can read assigned completed order", async () => {
    const snapshot = await getDoc(doc(db, "orders", orderId));

    if (!snapshot.exists()) {
      throw new Error("missing assigned order");
    }

    return snapshot.data().status;
  });
  await mustBlock("driver cannot list all orders", () =>
    getDocs(collection(db, "orders")),
  );

  await login("staging.owner@laundryapp.test");
  await mustPass("owner can read business order", async () => {
    const snapshot = await getDoc(doc(db, "orders", orderId));

    if (!snapshot.exists()) {
      throw new Error("missing order");
    }

    return snapshot.data().paymentStatus;
  });
  await mustBlock("owner cannot read audit logs", () =>
    getDocs(query(collection(db, "auditLogs"), limit(1))),
  );

  await login("staging.admin@laundryapp.test");
  await mustPass("admin can read audit logs for QA order", async () => {
    const snapshot = await getDocs(
      query(collection(db, "auditLogs"), orderBy("createdAt", "desc"), limit(80)),
    );
    const matches = snapshot.docs
      .map((auditDoc) => ({ id: auditDoc.id, ...auditDoc.data() }))
      .filter(
        (log) =>
          log.resourceId === orderId ||
          (Array.isArray(log.metadata?.orderIds) &&
            log.metadata.orderIds.includes(orderId)),
      );

    if (matches.length < 4) {
      throw new Error(`expected lifecycle audit logs, found ${matches.length}`);
    }

    return matches
      .slice(0, 8)
      .map((log) => log.action)
      .join(", ");
  });
} finally {
  await signOut(auth).catch(() => {});
  await deleteApp(app).catch(() => {});
}

for (const result of results) {
  console.log(`${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`);
}

if (results.some((result) => result.status === "FAIL")) {
  process.exit(1);
}
