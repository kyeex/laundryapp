import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

initializeApp();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const currency = process.env.STRIPE_CURRENCY ?? "usd";
const stripeCurrency = currency.toLowerCase();
const stagingSeedTag = "staging-demo";
const stagingSeedPassword = "LaundryDemo#2026!";
const defaultNotificationPreferences = {
  customerOrderUpdates: true,
  ownerNewRequests: true,
  ownerPaymentUpdates: true,
  driverAssignedRoutes: true,
  rewardsUpdates: true,
};

const allowedRoles = new Set(["customer", "owner", "driver", "admin"]);
const paymentEligibleOrderStatuses = new Set([
  "accepted",
  "received_at_store",
  "in_progress",
  "priced",
  "payment_requested",
  "ready_for_delivery",
]);
const stagingSeedUsers = [
  {
    uid: "staging-demo-customer",
    email: "staging.customer@laundryapp.test",
    displayName: "Staging Customer",
    phone: "555-1001",
    role: "customer",
  },
  {
    uid: "staging-demo-owner",
    email: "staging.owner@laundryapp.test",
    displayName: "Staging Owner",
    phone: "555-1002",
    role: "owner",
  },
  {
    uid: "staging-demo-driver",
    email: "staging.driver@laundryapp.test",
    displayName: "Staging Driver",
    phone: "555-1003",
    role: "driver",
  },
  {
    uid: "staging-demo-admin",
    email: "staging.admin@laundryapp.test",
    displayName: "Staging Admin",
    phone: "555-1004",
    role: "admin",
  },
] as const;

async function assertAdminUser(uid: string) {
  const userSnapshot = await getFirestore().collection("users").doc(uid).get();
  const user = userSnapshot.data();

  if (!user || user.role !== "admin" || user.active !== true) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
}

async function getActiveUserProfile(uid: string) {
  const userSnapshot = await getFirestore().collection("users").doc(uid).get();
  const user = userSnapshot.data();

  if (!user || user.active !== true) {
    throw new HttpsError("permission-denied", "An active app user is required.");
  }

  return {
    id: uid,
    email: user.email ?? "",
    role: user.role ?? "customer",
    displayName: user.displayName ?? "",
    phone: user.phone ?? "",
  };
}

async function assertOwnerOrAdminUser(uid: string) {
  const user = await getActiveUserProfile(uid);

  if (user.role !== "owner" && user.role !== "admin") {
    throw new HttpsError("permission-denied", "Owner or admin access is required.");
  }

  return user;
}

async function assertCustomerUser(uid: string) {
  const user = await getActiveUserProfile(uid);

  if (user.role !== "customer") {
    throw new HttpsError("permission-denied", "Customer access is required.");
  }

  return user;
}

function requireString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `${fieldName} is required.`);
  }

  return value.trim();
}

function requireRole(value: unknown) {
  const role = requireString(value, "role");

  if (!allowedRoles.has(role)) {
    throw new HttpsError("invalid-argument", "Invalid role.");
  }

  return role;
}

async function writeAuditLog(input: {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await getFirestore().collection("auditLogs").add({
    ...input,
    metadata: input.metadata ?? {},
    createdAt: new Date(),
  });
}

async function ensureManagedRoleProfile(
  userId: string,
  role: string,
  phone = "",
) {
  const db = getFirestore();

  if (role === "customer") {
    await db.collection("customerProfiles").doc(userId).set(
      {
        userId,
        defaultAddressId: null,
        notes: "",
        updatedAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  if (role === "driver") {
    await db.collection("driverProfiles").doc(userId).set(
      {
        userId,
        active: true,
        phone,
        vehicleInfo: "",
        updatedAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

function getFirebaseProjectId() {
  if (process.env.GCLOUD_PROJECT) {
    return process.env.GCLOUD_PROJECT;
  }

  if (process.env.FIREBASE_CONFIG) {
    try {
      const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG) as {
        projectId?: string;
      };

      return firebaseConfig.projectId ?? "";
    } catch {
      return "";
    }
  }

  return "";
}

function assertStagingDataToolsEnabled() {
  const projectId = getFirebaseProjectId();
  const normalizedProjectId = projectId.toLowerCase();

  if (!normalizedProjectId.includes("staging")) {
    throw new HttpsError(
      "failed-precondition",
      `Staging data tools are disabled for Firebase project '${projectId || "unknown"}'.`,
    );
  }

  if (normalizedProjectId.includes("prod") || normalizedProjectId.includes("production")) {
    throw new HttpsError(
      "failed-precondition",
      "Staging data tools are blocked on production Firebase projects.",
    );
  }

  return projectId;
}

function getIsoDateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

async function ensureStagingSeedUsers() {
  const auth = getAuth();
  const db = getFirestore();
  const created: Array<(typeof stagingSeedUsers)[number]["email"]> = [];
  const updated: Array<(typeof stagingSeedUsers)[number]["email"]> = [];

  for (const seedUser of stagingSeedUsers) {
    let existed = true;

    try {
      await auth.getUser(seedUser.uid);
    } catch {
      existed = false;
    }

    if (existed) {
      await auth.updateUser(seedUser.uid, {
        disabled: false,
        displayName: seedUser.displayName,
        email: seedUser.email,
        emailVerified: true,
        password: stagingSeedPassword,
      });
      updated.push(seedUser.email);
    } else {
      await auth.createUser({
        uid: seedUser.uid,
        disabled: false,
        displayName: seedUser.displayName,
        email: seedUser.email,
        emailVerified: true,
        password: stagingSeedPassword,
      });
      created.push(seedUser.email);
    }

    await auth.setCustomUserClaims(seedUser.uid, { role: seedUser.role });
    await db.collection("users").doc(seedUser.uid).set(
      {
        email: seedUser.email,
        role: seedUser.role,
        displayName: seedUser.displayName,
        phone: seedUser.phone,
        active: true,
        expoPushTokens: [],
        notificationPreferences: defaultNotificationPreferences,
        seedTag: stagingSeedTag,
        updatedAt: new Date(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (seedUser.role === "customer") {
      await db.collection("customerProfiles").doc(seedUser.uid).set(
        {
          userId: seedUser.uid,
          defaultAddressId: `${seedUser.uid}-default`,
          notes: "Seeded staging customer profile.",
          seedTag: stagingSeedTag,
          updatedAt: new Date(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    if (seedUser.role === "driver") {
      await db.collection("driverProfiles").doc(seedUser.uid).set(
        {
          userId: seedUser.uid,
          active: true,
          phone: seedUser.phone,
          vehicleInfo: "Seeded staging delivery vehicle",
          seedTag: stagingSeedTag,
          updatedAt: new Date(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return { created, updated };
}

function getSeedOrderRecords() {
  const customer = stagingSeedUsers.find((user) => user.role === "customer")!;
  const owner = stagingSeedUsers.find((user) => user.role === "owner")!;

  return [
    {
      id: "staging-demo-order-requested",
      addressId: "staging-demo-address-requested",
      order: {
        customerId: customer.uid,
        customerName: customer.displayName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        addressId: "staging-demo-address-requested",
        addressSnapshot: {
          label: "Home",
          street1: "120 Seedling Ave",
          street2: "Apt 4B",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11201",
          deliveryInstructions: "Text when arriving for pickup.",
        },
        selectedServiceIds: ["wash-fold"],
        selectedAddOns: [
          {
            id: "separate-colors",
            name: "Separate colors",
            description: "Separate colors from whites and lights.",
            price: 2.5,
            active: true,
            requiresOwnerConfirmation: false,
            sortOrder: 1,
            quantity: 1,
          },
        ],
        selectedDryCleaningItems: [],
        laundryPricePerPound: 2,
        deliveryMinimumPounds: 20,
        estimatedWeightPounds: 18,
        scheduledPickupDate: getIsoDateAfter(1),
        scheduledPickupWindow: "9:00 AM - 12:00 PM",
        scheduledDropoffDate: getIsoDateAfter(3),
        scheduledDropoffWindow: "12:00 PM - 3:00 PM",
        status: "requested",
        customerNotes: "Seeded staging order ready for accept or decline.",
        ownerNotes: "",
        driverNotes: "",
        gratuityAmount: 6.38,
        estimatedSubtotal: 48.88,
        paymentStatus: "unpaid",
        finalPrice: null,
        pickupBatchId: null,
        deliveryBatchId: null,
        assignedPickupDriverId: null,
        assignedDeliveryDriverId: null,
        seedTag: stagingSeedTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      event: {
        type: "order_created",
        fromStatus: null,
        toStatus: "requested",
        message: "Seeded staging order was created.",
        createdBy: customer.uid,
      },
    },
    {
      id: "staging-demo-order-accepted",
      addressId: "staging-demo-address-accepted",
      order: {
        customerId: customer.uid,
        customerName: customer.displayName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        addressId: "staging-demo-address-accepted",
        addressSnapshot: {
          label: "Office",
          street1: "88 Workflow Way",
          street2: "Suite 210",
          city: "Queens",
          state: "NY",
          postalCode: "11101",
          deliveryInstructions: "Pickup bags at reception.",
        },
        selectedServiceIds: ["wash-fold-dry-cleaning"],
        selectedAddOns: [],
        selectedDryCleaningItems: [
          {
            id: "button-down-long-sleeve",
            name: "Button down long sleeve",
            description: "Pressed long-sleeve button down shirt.",
            price: 5,
            active: true,
            sortOrder: 1,
            quantity: 3,
          },
        ],
        laundryPricePerPound: 2,
        deliveryMinimumPounds: 20,
        estimatedWeightPounds: 22,
        scheduledPickupDate: getIsoDateAfter(1),
        scheduledPickupWindow: "12:00 PM - 3:00 PM",
        scheduledDropoffDate: getIsoDateAfter(4),
        scheduledDropoffWindow: "3:00 PM - 6:00 PM",
        status: "accepted",
        customerNotes: "Seeded staging accepted order ready for pickup batch.",
        ownerNotes: "Accepted during staging seed.",
        driverNotes: "",
        gratuityAmount: 8.85,
        estimatedSubtotal: 67.85,
        paymentStatus: "unpaid",
        finalPrice: null,
        pickupBatchId: null,
        deliveryBatchId: null,
        assignedPickupDriverId: null,
        assignedDeliveryDriverId: null,
        seedTag: stagingSeedTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      event: {
        type: "status_changed",
        fromStatus: "requested",
        toStatus: "accepted",
        message: "Owner accepted seeded staging order.",
        createdBy: owner.uid,
      },
    },
    {
      id: "staging-demo-order-delivery-ready",
      addressId: "staging-demo-address-delivery-ready",
      order: {
        customerId: customer.uid,
        customerName: customer.displayName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        addressId: "staging-demo-address-delivery-ready",
        addressSnapshot: {
          label: "Condo",
          street1: "17 Delivery Lane",
          street2: "Floor 6",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11249",
          deliveryInstructions: "Leave with concierge if unavailable.",
        },
        selectedServiceIds: ["wash-fold"],
        selectedAddOns: [
          {
            id: "comforter-queen",
            name: "Queen comforter",
            description: "Queen-size comforter cleaning.",
            price: 12,
            active: true,
            requiresOwnerConfirmation: false,
            sortOrder: 2,
            quantity: 1,
          },
        ],
        selectedDryCleaningItems: [],
        laundryPricePerPound: 2,
        deliveryMinimumPounds: 20,
        estimatedWeightPounds: 27,
        scheduledPickupDate: getIsoDateAfter(-1),
        scheduledPickupWindow: "9:00 AM - 12:00 PM",
        scheduledDropoffDate: getIsoDateAfter(1),
        scheduledDropoffWindow: "12:00 PM - 3:00 PM",
        status: "ready_for_delivery",
        customerNotes: "Seeded staging order ready for delivery batch.",
        ownerNotes: "Priced and paid in staging seed.",
        driverNotes: "",
        gratuityAmount: 9.9,
        estimatedSubtotal: 75.9,
        paymentStatus: "paid",
        finalPrice: 75.9,
        pickupBatchId: null,
        deliveryBatchId: null,
        assignedPickupDriverId: null,
        assignedDeliveryDriverId: null,
        seedTag: stagingSeedTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      event: {
        type: "status_changed",
        fromStatus: "paid",
        toStatus: "ready_for_delivery",
        message: "Seeded staging order is ready for delivery.",
        createdBy: owner.uid,
      },
    },
    {
      id: "staging-demo-order-pricing-test",
      addressId: "staging-demo-address-pricing-test",
      order: {
        customerId: customer.uid,
        customerName: "Jamie Price",
        customerEmail: "jamie.price@example.com",
        customerPhone: "555-0443",
        addressId: "staging-demo-address-pricing-test",
        addressSnapshot: {
          label: "Townhome",
          street1: "64 Cedar Lane",
          street2: "",
          city: "Brooklyn",
          state: "NY",
          postalCode: "11231",
          deliveryInstructions: "Pricing test order. Use this to test the $0.00 warning.",
        },
        selectedServiceIds: ["wash-fold"],
        selectedAddOns: [
          {
            id: "medium-washer",
            name: "Medium washer",
            description: "Medium washer load.",
            price: 5.75,
            active: true,
            requiresOwnerConfirmation: false,
            sortOrder: 2,
            quantity: 1,
          },
          {
            id: "tide-detergent",
            name: "Tide detergent",
            description: "Tide detergent selection.",
            price: 4,
            active: true,
            requiresOwnerConfirmation: false,
            sortOrder: 5,
            quantity: 1,
          },
        ],
        selectedDryCleaningItems: [],
        laundryPricePerPound: 2,
        deliveryMinimumPounds: 20,
        estimatedWeightPounds: 22,
        scheduledPickupDate: getIsoDateAfter(-1),
        scheduledPickupWindow: "12:00 PM - 3:00 PM",
        scheduledDropoffDate: getIsoDateAfter(2),
        scheduledDropoffWindow: "3:00 PM - 6:00 PM",
        status: "in_progress",
        customerNotes: "Seeded pricing test order. Try saving final price as 0.00.",
        ownerNotes: "Pricing test order seeded for final-price validation.",
        driverNotes: "",
        gratuityAmount: 8.06,
        estimatedSubtotal: 61.81,
        paymentStatus: "unpaid",
        finalPrice: null,
        pickupBatchId: null,
        deliveryBatchId: null,
        assignedPickupDriverId: null,
        assignedDeliveryDriverId: null,
        seedTag: stagingSeedTag,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      event: {
        type: "status_changed",
        fromStatus: "received_at_store",
        toStatus: "in_progress",
        message: "Seeded staging pricing test order is ready for final price entry.",
        createdBy: owner.uid,
      },
    },
  ] as const;
}

async function deleteSeededDocuments(collectionName: string) {
  const db = getFirestore();
  const snapshot = await db
    .collection(collectionName)
    .where("seedTag", "==", stagingSeedTag)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;

  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = db.batch();
    const docs = snapshot.docs.slice(index, index + 450);

    docs.forEach((seededDoc) => batch.delete(seededDoc.ref));
    await batch.commit();
    deletedCount += docs.length;
  }

  return deletedCount;
}

async function resetStagingSeedBusinessData() {
  const collections = [
    "batches",
    "orders",
    "addresses",
    "orderEvents",
    "payments",
  ];
  const deleted: Record<string, number> = {};

  for (const collectionName of collections) {
    deleted[collectionName] = await deleteSeededDocuments(collectionName);
  }

  return deleted;
}

function getStripe() {
  const secretKey = stripeSecretKey.value() || process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new HttpsError(
      "failed-precondition",
      "STRIPE_SECRET_KEY is not configured.",
    );
  }

  return new Stripe(secretKey);
}

async function getOrCreateStripeCustomer(input: {
  uid: string;
  email?: string;
  displayName?: string;
  phone?: string;
}) {
  const db = getFirestore();
  const profileRef = db.collection("customerProfiles").doc(input.uid);
  const profileSnapshot = await profileRef.get();
  const existingStripeCustomerId = profileSnapshot.data()?.stripeCustomerId;

  if (typeof existingStripeCustomerId === "string" && existingStripeCustomerId) {
    return existingStripeCustomerId;
  }

  const stripeCustomer = await getStripe().customers.create({
    email: input.email,
    name: input.displayName,
    phone: input.phone,
    metadata: {
      appUserId: input.uid,
    },
  });

  await profileRef.set(
    {
      userId: input.uid,
      stripeCustomerId: stripeCustomer.id,
      updatedAt: new Date(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return stripeCustomer.id;
}

function getStripePaymentMethodId(paymentMethod: string | Stripe.PaymentMethod) {
  return typeof paymentMethod === "string" ? paymentMethod : paymentMethod.id;
}

function getStripeCardSummary(paymentMethod: Stripe.PaymentMethod) {
  const card = paymentMethod.card;

  if (!card) {
    throw new HttpsError("failed-precondition", "Only card payment methods are supported.");
  }

  return {
    brand: card.brand,
    last4: card.last4,
    expirationMonth: String(card.exp_month).padStart(2, "0"),
    expirationYear: String(card.exp_year),
  };
}

const defaultRewardSettings = {
  enabled: true,
  pointsPerDollar: 1,
  pointsPerRewardDollar: 100,
  signupBonusPoints: 50,
  tierThresholds: {
    freshStart: 0,
    foldFavorite: 250,
    laundryLoyalist: 750,
  },
  expirationMonths: null as number | null,
};

function requirePositiveNumber(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new HttpsError("invalid-argument", `${fieldName} must be greater than 0.`);
  }

  return value;
}

function requireNonNegativeMoney(value: unknown, fieldName: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new HttpsError("invalid-argument", `${fieldName} cannot be negative.`);
  }

  return Math.round(value * 100) / 100;
}

function toStripeAmount(value: number) {
  return Math.round(value * 100);
}

function calculatePointsForRewardCredit(creditDollars: number, settings: typeof defaultRewardSettings) {
  return Math.max(0, Math.round(creditDollars * settings.pointsPerRewardDollar));
}

function calculateEarnedPoints(orderTotal: number, settings: typeof defaultRewardSettings) {
  return Math.max(0, Math.floor(orderTotal * settings.pointsPerDollar));
}

function getEventExpirationDate(settings: typeof defaultRewardSettings) {
  if (!settings.expirationMonths) {
    return null;
  }

  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + settings.expirationMonths);

  return expiration;
}

async function getRewardSettings() {
  const settingsSnapshot = await getFirestore()
    .collection("settings")
    .doc("business")
    .get();
  const settings = settingsSnapshot.data()?.loyaltyRewards ?? {};

  return {
    ...defaultRewardSettings,
    ...settings,
    tierThresholds: {
      ...defaultRewardSettings.tierThresholds,
      ...settings.tierThresholds,
    },
  };
}

function mapRewardsAccount(
  customerId: string,
  customerName: string,
  data?: Record<string, any>,
) {
  return {
    customerId,
    customerName: data?.customerName ?? customerName,
    lifetimePoints: Math.max(0, Math.round(data?.lifetimePoints ?? 0)),
    pointsBalance: Math.max(0, Math.round(data?.pointsBalance ?? 0)),
    redeemedPoints: Math.max(0, Math.round(data?.redeemedPoints ?? 0)),
    recentActivity: Array.isArray(data?.recentActivity)
      ? data.recentActivity.slice(0, 12)
      : [],
  };
}

async function applyRewardEvent(input: {
  customerId: string;
  customerName: string;
  eventId: string;
  event: Record<string, unknown> & {
    points: number;
    type: string;
  };
}) {
  const db = getFirestore();
  const accountRef = db.collection("loyaltyRewards").doc(input.customerId);
  const eventRef = db.collection("loyaltyRewardEvents").doc(input.eventId);

  await db.runTransaction(async (transaction) => {
    const [accountSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(accountRef),
      transaction.get(eventRef),
    ]);

    if (eventSnapshot.exists) {
      return;
    }

    const currentAccount = mapRewardsAccount(
      input.customerId,
      input.customerName,
      accountSnapshot.data(),
    );
    const nextPointsBalance = currentAccount.pointsBalance + input.event.points;

    if (nextPointsBalance < 0) {
      throw new HttpsError(
        "failed-precondition",
        "This reward change would make the points balance negative.",
      );
    }

    const nextRecentActivity = [
      {
        id: input.eventId,
        ...input.event,
      },
      ...currentAccount.recentActivity,
    ].slice(0, 12);

    transaction.set(
      accountRef,
      {
        customerId: input.customerId,
        customerName: input.customerName,
        lifetimePoints:
          input.event.points > 0
            ? currentAccount.lifetimePoints + input.event.points
            : currentAccount.lifetimePoints,
        pointsBalance: nextPointsBalance,
        recentActivity: nextRecentActivity,
        redeemedPoints:
          input.event.type === "redeemed"
            ? currentAccount.redeemedPoints + Math.abs(input.event.points)
            : currentAccount.redeemedPoints,
        updatedAt: new Date(),
      },
      { merge: true },
    );
    transaction.set(eventRef, {
      ...input.event,
      customerId: input.customerId,
      customerName: input.customerName,
      createdAt: input.event.createdAt ?? new Date(),
    });
  });

  return (await accountRef.get()).data();
}

async function redeemRewardsForPaidOrderInternal(input: {
  actorId: string;
  customerId: string;
  customerName: string;
  orderId: string;
  rewardCreditDollars: number;
}) {
  const settings = await getRewardSettings();

  if (!settings.enabled || input.rewardCreditDollars <= 0) {
    return null;
  }

  const pointsToRedeem = calculatePointsForRewardCredit(
    input.rewardCreditDollars,
    settings,
  );

  if (pointsToRedeem <= 0) {
    return null;
  }

  const account = await applyRewardEvent({
    customerId: input.customerId,
    customerName: input.customerName,
    eventId: `redeem-${input.orderId}`,
    event: {
      type: "redeemed",
      createdBy: input.actorId,
      label: `$${input.rewardCreditDollars.toFixed(2)} reward credit for order`,
      orderId: input.orderId,
      points: -pointsToRedeem,
      redemptionDollars: input.rewardCreditDollars,
      createdAt: new Date(),
      expiresAt: null,
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: "customer",
    action: "rewards.redeemed",
    resourceType: "rewards",
    resourceId: input.customerId,
    summary: `Redeemed ${pointsToRedeem} rewards points for order ${input.orderId}.`,
    metadata: {
      customerId: input.customerId,
      orderId: input.orderId,
      points: pointsToRedeem,
      rewardCreditDollars: input.rewardCreditDollars,
    },
  });

  return account;
}

async function awardOrderRewardsForPaidOrderInternal(input: {
  actorId: string;
  actorRole: string;
  customerId: string;
  customerName: string;
  orderId: string;
  orderNumber?: string | null;
  orderValue: number;
}) {
  const settings = await getRewardSettings();

  if (!settings.enabled) {
    return { account: null, points: 0 };
  }

  const earnedPoints = calculateEarnedPoints(input.orderValue, settings);

  if (earnedPoints <= 0) {
    return { account: null, points: 0 };
  }

  const account = await applyRewardEvent({
    customerId: input.customerId,
    customerName: input.customerName,
    eventId: `earn-${input.orderId}`,
    event: {
      type: "earned",
      createdBy: input.actorId,
      label: `Earned from order ${input.orderNumber ?? input.orderId}`,
      orderId: input.orderId,
      points: earnedPoints,
      createdAt: new Date(),
      expiresAt: getEventExpirationDate(settings),
    },
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "rewards.earned",
    resourceType: "rewards",
    resourceId: input.customerId,
    summary: `Awarded ${earnedPoints} points for a paid order.`,
    metadata: {
      customerId: input.customerId,
      orderId: input.orderId,
      points: earnedPoints,
    },
  });

  return { account, points: earnedPoints };
}

export const redeemRewardsForOrder = onCall<{
  orderId: string;
  rewardCreditDollars: number;
}>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before redeeming rewards.");
  }

  const orderId = requireString(request.data.orderId, "orderId");
  const rewardCreditDollars = requirePositiveNumber(
    request.data.rewardCreditDollars,
    "rewardCreditDollars",
  );
  const db = getFirestore();
  const orderSnapshot = await db.collection("orders").doc(orderId).get();
  const order = orderSnapshot.data();

  if (!order) {
    throw new HttpsError("not-found", "Order not found.");
  }

  if (order.customerId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "This order belongs to another customer.");
  }

  if (order.paymentStatus !== "paid") {
    throw new HttpsError(
      "failed-precondition",
      "Rewards are redeemed after payment is completed.",
    );
  }

  return {
    account: await redeemRewardsForPaidOrderInternal({
      actorId: request.auth.uid,
      customerId: order.customerId,
      customerName: order.customerName ?? "Customer",
      orderId,
      rewardCreditDollars,
    }),
  };
});

export const awardOrderRewardsForPaidOrder = onCall<{ orderId: string }>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before awarding rewards.");
    }

    const actor = await assertOwnerOrAdminUser(request.auth.uid);
    const orderId = requireString(request.data.orderId, "orderId");
    const db = getFirestore();
    const orderSnapshot = await db.collection("orders").doc(orderId).get();
    const order = orderSnapshot.data();

    if (!order) {
      throw new HttpsError("not-found", "Order not found.");
    }

    if (order.paymentStatus !== "paid") {
      throw new HttpsError(
        "failed-precondition",
        "Rewards can only be awarded for paid orders.",
      );
    }

    const orderValue =
      typeof order.finalPrice === "number"
        ? order.finalPrice
        : Number(order.estimatedSubtotal ?? 0);

    return await awardOrderRewardsForPaidOrderInternal({
      actorId: request.auth.uid,
      actorRole: actor.role,
      customerId: order.customerId,
      customerName: order.customerName ?? "Customer",
      orderId,
      orderNumber: order.orderNumber ?? null,
      orderValue,
    });
  },
);

export const adjustCustomerRewards = onCall<{
  customerId: string;
  customerName?: string;
  points: number;
  reason: string;
}>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before adjusting rewards.");
  }

  const actor = await assertOwnerOrAdminUser(request.auth.uid);
  const customerId = requireString(request.data.customerId, "customerId");
  const reason = requireString(request.data.reason, "reason");
  const points = request.data.points;

  if (typeof points !== "number" || !Number.isFinite(points) || points === 0) {
    throw new HttpsError("invalid-argument", "points must be a non-zero number.");
  }

  const customerSnapshot = await getFirestore().collection("users").doc(customerId).get();
  const customer = customerSnapshot.data();
  const customerName =
    request.data.customerName?.trim() ||
    customer?.displayName ||
    customer?.email ||
    "Customer";
  const roundedPoints = Math.round(points);
  const account = await applyRewardEvent({
    customerId,
    customerName,
    eventId: `adjust-${Date.now()}`,
    event: {
      type: "adjusted",
      createdBy: request.auth.uid,
      label: roundedPoints > 0 ? "Manual points added" : "Manual points removed",
      points: roundedPoints,
      reason,
      createdAt: new Date(),
      expiresAt: null,
    },
  });

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: actor.role,
    action: "rewards.adjusted",
    resourceType: "rewards",
    resourceId: customerId,
    summary: `Adjusted rewards by ${roundedPoints} points.`,
    metadata: {
      customerId,
      points: roundedPoints,
      reason,
    },
  });

  return { account };
});

export const createManagedUserAccount = onCall<{
  displayName: string;
  email: string;
  phone?: string;
  role: string;
}>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before managing users.");
  }

  await assertAdminUser(request.auth.uid);

  const displayName = requireString(request.data.displayName, "displayName");
  const email = requireString(request.data.email, "email").toLowerCase();
  const phone =
    typeof request.data.phone === "string" ? request.data.phone.trim() : "";
  const role = requireRole(request.data.role);
  const auth = getAuth();
  const tempPassword = randomUUID();

  const authUser = await auth.createUser({
    disabled: false,
    displayName,
    email,
    emailVerified: false,
    password: tempPassword,
  });

  await auth.setCustomUserClaims(authUser.uid, { role });

  const user = {
    email,
    role,
    displayName,
    phone,
    active: true,
    expoPushTokens: [],
    notificationPreferences: defaultNotificationPreferences,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const db = getFirestore();
  await db.collection("users").doc(authUser.uid).set(user);

  await ensureManagedRoleProfile(authUser.uid, role, phone);

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: "admin",
    action: "user.created",
    resourceType: "user",
    resourceId: authUser.uid,
    summary: `Created ${role} user ${email}.`,
    metadata: { email, role },
  });

  return {
    user: {
      id: authUser.uid,
      ...user,
    },
  };
});

export const updateManagedUserAccess = onCall<{
  userId: string;
  updates: {
    active?: boolean;
    role?: string;
    displayName?: string;
    phone?: string;
  };
}>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before managing users.");
  }

  await assertAdminUser(request.auth.uid);

  const userId = requireString(request.data.userId, "userId");
  const updates = request.data.updates ?? {};
  const userPatch: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  const authPatch: {
    disabled?: boolean;
    displayName?: string;
  } = {};

  if (typeof updates.active === "boolean") {
    userPatch.active = updates.active;
    authPatch.disabled = !updates.active;
  }

  if (typeof updates.role !== "undefined") {
    userPatch.role = requireRole(updates.role);
  }

  if (typeof updates.displayName === "string") {
    userPatch.displayName = updates.displayName.trim();
    authPatch.displayName = updates.displayName.trim();
  }

  if (typeof updates.phone === "string") {
    userPatch.phone = updates.phone.trim();
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(userId);
  const beforeSnapshot = await userRef.get();

  if (!beforeSnapshot.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  await userRef.update(userPatch);

  if (typeof userPatch.role === "string") {
    await ensureManagedRoleProfile(userId, userPatch.role, updates.phone);
  }

  if (Object.keys(authPatch).length > 0) {
    await getAuth().updateUser(userId, authPatch);
  }

  if (typeof userPatch.role === "string") {
    await getAuth().setCustomUserClaims(userId, { role: userPatch.role });
  }

  const afterSnapshot = await userRef.get();
  const afterUser = afterSnapshot.data();

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: "admin",
    action: "user.access_updated",
    resourceType: "user",
    resourceId: userId,
    summary: "Updated user access settings.",
    metadata: {
      updates,
    },
  });

  return {
    user: {
      id: userId,
      email: afterUser?.email ?? "",
      role: afterUser?.role ?? "customer",
      displayName: afterUser?.displayName ?? "",
      phone: afterUser?.phone ?? "",
      active: afterUser?.active ?? true,
      expoPushTokens: afterUser?.expoPushTokens ?? [],
    },
  };
});

export const seedStagingUsers = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before seeding users.");
  }

  await assertAdminUser(request.auth.uid);
  const projectId = assertStagingDataToolsEnabled();
  const result = await ensureStagingSeedUsers();

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: "admin",
    action: "staging.seed_users",
    resourceType: "configuration",
    resourceId: stagingSeedTag,
    summary: "Seeded staging role users.",
    metadata: {
      projectId,
      created: result.created,
      updated: result.updated,
      seedTag: stagingSeedTag,
    },
  });

  return {
    projectId,
    seedTag: stagingSeedTag,
    password: stagingSeedPassword,
    users: stagingSeedUsers.map((user) => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    })),
    createdCount: result.created.length,
    updatedCount: result.updated.length,
  };
});

export const seedStagingSampleOrders = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before seeding orders.");
  }

  await assertAdminUser(request.auth.uid);
  const projectId = assertStagingDataToolsEnabled();
  await ensureStagingSeedUsers();
  await resetStagingSeedBusinessData();

  const db = getFirestore();
  const seedOrders = getSeedOrderRecords();

  for (const seedOrder of seedOrders) {
    await db.collection("addresses").doc(seedOrder.addressId).set({
      ...seedOrder.order.addressSnapshot,
      userId: seedOrder.order.customerId,
      seedTag: stagingSeedTag,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.collection("orders").doc(seedOrder.id).set(seedOrder.order);
    await db.collection("orderEvents").doc(`${seedOrder.id}-event`).set({
      orderId: seedOrder.id,
      seedTag: stagingSeedTag,
      createdAt: new Date(),
      ...seedOrder.event,
    });
  }

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: "admin",
    action: "staging.seed_orders",
    resourceType: "configuration",
    resourceId: stagingSeedTag,
    summary: "Seeded staging sample orders.",
    metadata: {
      projectId,
      seedTag: stagingSeedTag,
      orderIds: seedOrders.map((order) => order.id),
    },
  });

  return {
    projectId,
    seedTag: stagingSeedTag,
    orderIds: seedOrders.map((order) => order.id),
    createdOrderCount: seedOrders.length,
  };
});

export const resetStagingDemoData = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before resetting data.");
  }

  await assertAdminUser(request.auth.uid);
  const projectId = assertStagingDataToolsEnabled();
  const deleted = await resetStagingSeedBusinessData();

  await writeAuditLog({
    actorId: request.auth.uid,
    actorRole: "admin",
    action: "staging.reset_demo_data",
    resourceType: "configuration",
    resourceId: stagingSeedTag,
    summary: "Reset seeded staging business data.",
    metadata: {
      projectId,
      seedTag: stagingSeedTag,
      deleted,
      preservedUsers: true,
    },
  });

  return {
    projectId,
    seedTag: stagingSeedTag,
    deleted,
    preservedUsers: true,
  };
});

export const getStagingSeedStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before viewing seed status.");
  }

  await assertAdminUser(request.auth.uid);
  const projectId = assertStagingDataToolsEnabled();
  const db = getFirestore();
  const [users, orders, batches, addresses] = await Promise.all([
    db.collection("users").where("seedTag", "==", stagingSeedTag).get(),
    db.collection("orders").where("seedTag", "==", stagingSeedTag).get(),
    db.collection("batches").where("seedTag", "==", stagingSeedTag).get(),
    db.collection("addresses").where("seedTag", "==", stagingSeedTag).get(),
  ]);

  return {
    projectId,
    seedTag: stagingSeedTag,
    userCount: users.size,
    orderCount: orders.size,
    batchCount: batches.size,
    addressCount: addresses.size,
  };
});

export const createPaymentIntent = onCall<{
  orderId: string;
  rewardCreditDollars?: number;
}>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before paying.");
    }

    const customer = await assertCustomerUser(request.auth.uid);
    const orderId = requireString(request.data.orderId, "orderId");
    const rewardCreditDollars = requireNonNegativeMoney(
      request.data.rewardCreditDollars ?? 0,
      "rewardCreditDollars",
    );

    const db = getFirestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }

    const order = orderSnapshot.data();

    if (!order) {
      throw new HttpsError("not-found", "Order not found.");
    }

    if (order.customerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "This order belongs to another customer.");
    }

    if (!paymentEligibleOrderStatuses.has(order.status)) {
      throw new HttpsError(
        "failed-precondition",
        "This order is not ready for payment yet.",
      );
    }

    if (order.paymentStatus === "paid") {
      throw new HttpsError("failed-precondition", "This order is already paid.");
    }

    if (typeof order.finalPrice !== "number" || order.finalPrice <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "The owner must set a final price before payment.",
      );
    }

    if (rewardCreditDollars > order.finalPrice) {
      throw new HttpsError(
        "failed-precondition",
        "Reward credit cannot exceed the final price.",
      );
    }

    let rewardPointsToRedeem = 0;

    if (rewardCreditDollars > 0) {
      const settings = await getRewardSettings();

      if (!settings.enabled) {
        throw new HttpsError("failed-precondition", "Rewards are not enabled.");
      }

      rewardPointsToRedeem = calculatePointsForRewardCredit(
        rewardCreditDollars,
        settings,
      );

      const rewardsSnapshot = await db
        .collection("loyaltyRewards")
        .doc(request.auth.uid)
        .get();
      const rewardsAccount = mapRewardsAccount(
        request.auth.uid,
        order.customerName ?? "Customer",
        rewardsSnapshot.data(),
      );

      if (rewardPointsToRedeem <= 0) {
        throw new HttpsError("invalid-argument", "Choose a valid reward credit.");
      }

      if (rewardsAccount.pointsBalance < rewardPointsToRedeem) {
        throw new HttpsError(
          "failed-precondition",
          "Not enough rewards points for that credit.",
        );
      }
    }

    const payableAmount = Math.round((order.finalPrice - rewardCreditDollars) * 100) / 100;

    if (payableAmount <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Reward credit cannot cover the entire balance until no-card checkout is enabled.",
      );
    }

    const amount = toStripeAmount(payableAmount);

    if (amount <= 0) {
      throw new HttpsError("failed-precondition", "Payment amount must be greater than $0.00.");
    }

    const stripe = getStripe();

    if (
      order.paymentStatus === "pending"
      && typeof order.paymentId === "string"
      && order.paymentId
    ) {
      const existingPaymentIntent = await stripe.paymentIntents.retrieve(order.paymentId);
      const rewardCreditMatches =
        existingPaymentIntent.metadata.rewardCreditDollars ===
        String(rewardCreditDollars);

      if (existingPaymentIntent.status === "succeeded") {
        throw new HttpsError(
          "failed-precondition",
          "This payment already succeeded and is waiting for confirmation.",
        );
      }

      if (
        existingPaymentIntent.status !== "canceled"
        && existingPaymentIntent.amount === amount
        && existingPaymentIntent.currency === stripeCurrency
        && rewardCreditMatches
        && existingPaymentIntent.client_secret
      ) {
        return {
          paymentIntentClientSecret: existingPaymentIntent.client_secret,
        };
      }

      const canCancelExistingPaymentIntent =
        existingPaymentIntent.status === "requires_payment_method"
        || existingPaymentIntent.status === "requires_confirmation"
        || existingPaymentIntent.status === "requires_action";

      if (canCancelExistingPaymentIntent) {
        await stripe.paymentIntents.cancel(order.paymentId);
      } else {
        throw new HttpsError(
          "failed-precondition",
          "A previous payment is still processing. Wait for it to finish before starting a new payment.",
        );
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: stripeCurrency,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
        metadata: {
          orderId,
          customerId: request.auth.uid,
          rewardCreditDollars: String(rewardCreditDollars),
          rewardPointsToRedeem: String(rewardPointsToRedeem),
        },
        description: `Laundry order ${order.orderNumber ?? orderId}`,
      },
      {
        idempotencyKey: `order-${orderId}-amount-${amount}-reward-${rewardPointsToRedeem}`,
      },
    );

    await orderRef.update({
      paymentStatus: "pending",
      paymentId: paymentIntent.id,
      paymentAmountDue: payableAmount,
      rewardCreditAmount: rewardCreditDollars,
      rewardPointsRedeemed: rewardPointsToRedeem,
      rewardRedemptionId: rewardCreditDollars > 0 ? `redeem-${orderId}` : null,
      updatedAt: new Date(),
    });

    await db.collection("payments").doc(paymentIntent.id).set({
      amount,
      amountDollars: payableAmount,
      currency: stripeCurrency,
      customerId: request.auth.uid,
      customerName: order.customerName ?? customer.displayName,
      orderId,
      orderNumber: order.orderNumber ?? null,
      paymentIntentId: paymentIntent.id,
      provider: "stripe",
      rewardCreditAmount: rewardCreditDollars,
      rewardPointsRedeemed: rewardPointsToRedeem,
      status: paymentIntent.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!paymentIntent.client_secret) {
      throw new HttpsError("internal", "Stripe did not return a client secret.");
    }

    return {
      paymentIntentClientSecret: paymentIntent.client_secret,
    };
  },
);

export const createOrderReviewSetupIntent = onCall<{ estimatedTotal?: number }>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before adding a card.");
    }

    const customer = await assertCustomerUser(request.auth.uid);
    const stripeCustomerId = await getOrCreateStripeCustomer({
      uid: request.auth.uid,
      email: customer.email,
      displayName: customer.displayName,
      phone: customer.phone,
    });

    const setupIntent = await getStripe().setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        customerId: request.auth.uid,
        estimatedTotal: String(request.data.estimatedTotal ?? ""),
        purpose: "laundry_order_review",
      },
    });

    if (!setupIntent.client_secret) {
      throw new HttpsError("internal", "Stripe did not return a setup client secret.");
    }

    await getFirestore().collection("paymentSetups").doc(setupIntent.id).set({
      customerId: request.auth.uid,
      stripeCustomerId,
      setupIntentId: setupIntent.id,
      status: setupIntent.status,
      provider: "stripe",
      purpose: "laundry_order_review",
      estimatedTotal: request.data.estimatedTotal ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      setupIntentClientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      stripeCustomerId,
    };
  },
);

export const confirmOrderReviewSetupIntent = onCall<{ setupIntentId: string }>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before saving a card.");
    }

    await assertCustomerUser(request.auth.uid);
    const setupIntentId = requireString(request.data.setupIntentId, "setupIntentId");
    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.metadata?.customerId !== request.auth.uid) {
      throw new HttpsError(
        "permission-denied",
        "This saved payment method belongs to another customer.",
      );
    }

    if (setupIntent.status !== "succeeded") {
      throw new HttpsError(
        "failed-precondition",
        `Stripe setup is ${setupIntent.status}.`,
      );
    }

    if (!setupIntent.payment_method) {
      throw new HttpsError(
        "failed-precondition",
        "Stripe did not attach a payment method.",
      );
    }

    const paymentMethodId = getStripePaymentMethodId(setupIntent.payment_method);
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    const cardSummary = getStripeCardSummary(paymentMethod);
    const stripeCustomerId =
      typeof setupIntent.customer === "string"
        ? setupIntent.customer
        : setupIntent.customer?.id;

    if (!stripeCustomerId) {
      throw new HttpsError("failed-precondition", "Stripe customer is missing.");
    }

    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await getFirestore().collection("customerProfiles").doc(request.auth.uid).set(
      {
        userId: request.auth.uid,
        stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        paymentMethod: {
          cardholderName: paymentMethod.billing_details.name ?? "",
          brand: cardSummary.brand,
          last4: cardSummary.last4,
          expirationMonth: cardSummary.expirationMonth,
          expirationYear: cardSummary.expirationYear,
          stripeCustomerId,
          stripePaymentMethodId: paymentMethodId,
          stripeSetupIntentId: setupIntent.id,
        },
        updatedAt: new Date(),
      },
      { merge: true },
    );

    await getFirestore().collection("paymentSetups").doc(setupIntent.id).set(
      {
        customerId: request.auth.uid,
        stripeCustomerId,
        setupIntentId: setupIntent.id,
        stripePaymentMethodId: paymentMethodId,
        status: setupIntent.status,
        brand: cardSummary.brand,
        last4: cardSummary.last4,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    await writeAuditLog({
      actorId: request.auth.uid,
      actorRole: "customer",
      action: "payment.method_saved",
      resourceType: "payment",
      resourceId: setupIntent.id,
      summary: "Customer saved a Stripe payment method for order review.",
      metadata: {
        stripeCustomerId,
        stripePaymentMethodId: paymentMethodId,
        brand: cardSummary.brand,
        last4: cardSummary.last4,
      },
    });

    return {
      stripeCustomerId,
      setupIntentId: setupIntent.id,
      paymentMethodId,
      ...cardSummary,
    };
  },
);

function getExpectedStripeAmount(order: Record<string, any>) {
  if (typeof order.paymentAmountDue === "number") {
    return toStripeAmount(order.paymentAmountDue);
  }

  const finalPrice = typeof order.finalPrice === "number" ? order.finalPrice : 0;
  const rewardCreditAmount =
    typeof order.rewardCreditAmount === "number" ? order.rewardCreditAmount : 0;

  return toStripeAmount(finalPrice - rewardCreditAmount);
}

async function getOrderForPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  const customerId = paymentIntent.metadata.customerId;

  if (!orderId || !customerId) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe PaymentIntent is missing required order metadata.",
    );
  }

  const db = getFirestore();
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnapshot = await orderRef.get();
  const order = orderSnapshot.data();

  if (!order) {
    throw new HttpsError("not-found", "Order not found for Stripe PaymentIntent.");
  }

  if (order.customerId !== customerId) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe customer metadata does not match the order customer.",
    );
  }

  if (typeof order.paymentId === "string" && order.paymentId !== paymentIntent.id) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe PaymentIntent does not match the order payment reference.",
    );
  }

  const expectedAmount = getExpectedStripeAmount(order);

  if (
    paymentIntent.amount !== expectedAmount
    || paymentIntent.currency !== stripeCurrency
  ) {
    throw new HttpsError(
      "failed-precondition",
      "Stripe payment amount does not match the order balance.",
    );
  }

  return { db, order, orderId, orderRef };
}

function shouldIgnoreStripeWebhookError(error: unknown) {
  return error instanceof HttpsError
    && (error.code === "failed-precondition" || error.code === "not-found");
}

function logIgnoredStripeWebhook(event: Stripe.Event, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  console.info("Ignoring Stripe webhook event that does not match a LaundryApp order.", {
    eventId: event.id,
    eventType: event.type,
    message,
  });
}

async function markStripePaymentSucceeded(input: {
  paymentIntent: Stripe.PaymentIntent;
  actorId: string;
  actorRole: string;
}) {
  const { db, order, orderId, orderRef } = await getOrderForPaymentIntent(
    input.paymentIntent,
  );

  await db.collection("payments").doc(input.paymentIntent.id).set(
    {
      amount: input.paymentIntent.amount,
      amountDollars: input.paymentIntent.amount / 100,
      currency: input.paymentIntent.currency,
      customerId: order.customerId,
      customerName: order.customerName ?? "Customer",
      orderId,
      orderNumber: order.orderNumber ?? null,
      paymentIntentId: input.paymentIntent.id,
      provider: "stripe",
      status: input.paymentIntent.status,
      updatedAt: new Date(),
    },
    { merge: true },
  );

  if (order.paymentStatus === "paid") {
    return { status: "paid" };
  }

  await orderRef.update({
    paymentStatus: "paid",
    status: "paid",
    paymentId: input.paymentIntent.id,
    updatedAt: new Date(),
  });

  await db.collection("orderEvents").doc(`payment-${input.paymentIntent.id}-completed`).set(
    {
      orderId,
      type: "payment_completed",
      fromStatus: order.status ?? null,
      toStatus: "paid",
      message: "Customer completed payment.",
      createdBy: input.actorId,
      createdAt: new Date(),
    },
    { merge: false },
  ).catch(async (error) => {
    if (error?.code !== 6 && error?.code !== "already-exists") {
      throw error;
    }
  });

  await writeAuditLog({
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "payment.completed",
    resourceType: "payment",
    resourceId: input.paymentIntent.id,
    summary: `Payment completed for order ${order.orderNumber ?? orderId}.`,
    metadata: {
      customerId: order.customerId,
      orderId,
      paymentIntentId: input.paymentIntent.id,
      amount: input.paymentIntent.amount,
      currency: input.paymentIntent.currency,
    },
  });

  if (typeof order.rewardCreditAmount === "number" && order.rewardCreditAmount > 0) {
    await redeemRewardsForPaidOrderInternal({
      actorId: input.actorId,
      customerId: order.customerId,
      customerName: order.customerName ?? "Customer",
      orderId,
      rewardCreditDollars: order.rewardCreditAmount,
    });
  }

  const orderValue =
    typeof order.finalPrice === "number"
      ? order.finalPrice
      : Number(order.estimatedSubtotal ?? 0);

  await awardOrderRewardsForPaidOrderInternal({
    actorId: input.actorId,
    actorRole: input.actorRole,
    customerId: order.customerId,
    customerName: order.customerName ?? "Customer",
    orderId,
    orderNumber: order.orderNumber ?? null,
    orderValue,
  });

  return { status: "paid" };
}

async function markStripePaymentProcessing(paymentIntent: Stripe.PaymentIntent) {
  const { db, order, orderId, orderRef } = await getOrderForPaymentIntent(paymentIntent);

  if (order.paymentStatus !== "paid") {
    await orderRef.update({
      paymentStatus: "pending",
      paymentId: paymentIntent.id,
      updatedAt: new Date(),
    });
  }

  await db.collection("payments").doc(paymentIntent.id).set(
    {
      amount: paymentIntent.amount,
      amountDollars: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      customerId: order.customerId,
      orderId,
      paymentIntentId: paymentIntent.id,
      provider: "stripe",
      status: paymentIntent.status,
      updatedAt: new Date(),
    },
    { merge: true },
  );

  await db.collection("orderEvents").doc(`payment-${paymentIntent.id}-processing`).set(
    {
      orderId,
      type: "payment_processing",
      fromStatus: order.status ?? null,
      toStatus: "pending",
      message: "Payment is processing.",
      createdBy: "stripe",
      createdAt: new Date(),
    },
    { merge: true },
  );
}

async function markStripePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { db, order, orderId, orderRef } = await getOrderForPaymentIntent(paymentIntent);
  const failureMessage =
    paymentIntent.last_payment_error?.message ?? "Stripe reported payment failure.";

  if (order.paymentStatus !== "paid") {
    await orderRef.update({
      paymentStatus: "unpaid",
      paymentFailureMessage: failureMessage,
      updatedAt: new Date(),
    });
  }

  await db.collection("payments").doc(paymentIntent.id).set(
    {
      amount: paymentIntent.amount,
      amountDollars: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      customerId: order.customerId,
      orderId,
      paymentIntentId: paymentIntent.id,
      provider: "stripe",
      status: paymentIntent.status,
      failureMessage,
      updatedAt: new Date(),
    },
    { merge: true },
  );

  await db.collection("orderEvents").doc(`payment-${paymentIntent.id}-failed`).set(
    {
      orderId,
      type: "payment_failed",
      fromStatus: order.status ?? null,
      toStatus: "unpaid",
      message: failureMessage,
      createdBy: "stripe",
      createdAt: new Date(),
    },
    { merge: true },
  );

  await writeAuditLog({
    actorId: "stripe",
    actorRole: "system",
    action: "payment.failed",
    resourceType: "payment",
    resourceId: paymentIntent.id,
    summary: `Stripe payment failed for order ${order.orderNumber ?? orderId}.`,
    metadata: {
      customerId: order.customerId,
      orderId,
      paymentIntentId: paymentIntent.id,
      failureMessage,
    },
  });
}

export const chargeOrderSavedPaymentMethod = onCall<{ orderId: string }>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before charging an order.");
    }

    const actor = await assertOwnerOrAdminUser(request.auth.uid);
    const orderId = requireString(request.data.orderId, "orderId");
    const db = getFirestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();
    const order = orderSnapshot.data();

    if (!order) {
      throw new HttpsError("not-found", "Order not found.");
    }

    if (order.paymentStatus === "paid") {
      return { status: "paid" };
    }

    if (typeof order.finalPrice !== "number" || order.finalPrice <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "Save a final price before charging the customer.",
      );
    }

    if (
      typeof order.stripeCustomerId !== "string"
      || !order.stripeCustomerId
      || typeof order.stripePaymentMethodId !== "string"
      || !order.stripePaymentMethodId
    ) {
      throw new HttpsError(
        "failed-precondition",
        "This order does not have a saved Stripe payment method.",
      );
    }

    const amount = toStripeAmount(order.finalPrice);
    const stripe = getStripe();

    if (
      order.paymentStatus === "pending"
      && typeof order.paymentId === "string"
      && order.paymentId
    ) {
      const existingPaymentIntent = await stripe.paymentIntents.retrieve(order.paymentId);

      if (existingPaymentIntent.status === "succeeded") {
        return await markStripePaymentSucceeded({
          paymentIntent: existingPaymentIntent,
          actorId: request.auth.uid,
          actorRole: actor.role,
        });
      }

      throw new HttpsError(
        "failed-precondition",
        `A previous payment is ${existingPaymentIntent.status}.`,
      );
    }

    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount,
          currency: stripeCurrency,
          customer: order.stripeCustomerId,
          payment_method: order.stripePaymentMethodId,
          off_session: true,
          confirm: true,
          metadata: {
            orderId,
            customerId: order.customerId,
            chargedBy: request.auth.uid,
            source: "saved_payment_method",
          },
          description: `Laundry order ${order.orderNumber ?? orderId}`,
        },
        {
          idempotencyKey: `order-${orderId}-saved-card-${amount}`,
        },
      );

      await orderRef.update({
        paymentStatus:
          paymentIntent.status === "succeeded" ? "pending" : "pending",
        paymentId: paymentIntent.id,
        paymentAmountDue: order.finalPrice,
        updatedAt: new Date(),
      });

      await db.collection("payments").doc(paymentIntent.id).set({
        amount,
        amountDollars: order.finalPrice,
        currency: stripeCurrency,
        customerId: order.customerId,
        customerName: order.customerName ?? "",
        orderId,
        orderNumber: order.orderNumber ?? null,
        paymentIntentId: paymentIntent.id,
        provider: "stripe",
        source: "saved_payment_method",
        status: paymentIntent.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (paymentIntent.status === "succeeded") {
        return await markStripePaymentSucceeded({
          paymentIntent,
          actorId: request.auth.uid,
          actorRole: actor.role,
        });
      }

      if (paymentIntent.status === "processing") {
        await markStripePaymentProcessing(paymentIntent);
        return { status: "pending" };
      }

      throw new HttpsError(
        "failed-precondition",
        `Stripe payment is ${paymentIntent.status}.`,
      );
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : "Stripe charge failed.";
      await orderRef.update({
        paymentStatus: "unpaid",
        paymentFailureMessage: message,
        updatedAt: new Date(),
      });

      await db.collection("orderEvents").add({
        orderId,
        type: "payment_failed",
        fromStatus: order.status ?? null,
        toStatus: order.status ?? null,
        message,
        createdBy: request.auth.uid,
        createdAt: new Date(),
      });

      await writeAuditLog({
        actorId: request.auth.uid,
        actorRole: actor.role,
        action: "payment.charge_failed",
        resourceType: "payment",
        resourceId: orderId,
        summary: "Saved payment method charge failed.",
        metadata: {
          orderId,
          message,
        },
      });

      throw new HttpsError("failed-precondition", message);
    }
  },
);

async function markStripePaymentRefunded(input: {
  paymentIntentId: string;
  amountRefunded?: number;
  refundId?: string;
  status?: string;
}) {
  const db = getFirestore();
  const paymentSnapshot = await db.collection("payments").doc(input.paymentIntentId).get();
  const payment = paymentSnapshot.data();

  if (!payment?.orderId) {
    return;
  }

  const orderRef = db.collection("orders").doc(payment.orderId);
  const orderSnapshot = await orderRef.get();
  const order = orderSnapshot.data();

  if (!order) {
    return;
  }

  await orderRef.update({
    paymentStatus: "refunded",
    refundStatus: input.status ?? "refunded",
    updatedAt: new Date(),
  });

  await db.collection("payments").doc(input.paymentIntentId).set(
    {
      amountRefunded: input.amountRefunded ?? null,
      refundId: input.refundId ?? null,
      refundStatus: input.status ?? "refunded",
      status: "refunded",
      updatedAt: new Date(),
    },
    { merge: true },
  );

  await db.collection("orderEvents").doc(`payment-${input.paymentIntentId}-refunded`).set(
    {
      orderId: payment.orderId,
      type: "payment_refunded",
      fromStatus: order.status ?? null,
      toStatus: "refunded",
      message: "Stripe reported a refund for this order.",
      createdBy: "stripe",
      createdAt: new Date(),
    },
    { merge: true },
  );

  await writeAuditLog({
    actorId: "stripe",
    actorRole: "system",
    action: "payment.refunded",
    resourceType: "payment",
    resourceId: input.paymentIntentId,
    summary: `Stripe refund recorded for order ${order.orderNumber ?? payment.orderId}.`,
    metadata: {
      orderId: payment.orderId,
      paymentIntentId: input.paymentIntentId,
      refundId: input.refundId,
      amountRefunded: input.amountRefunded,
    },
  });
}

async function markStripePaymentDisputed(input: {
  paymentIntentId: string;
  disputeId: string;
  status?: string;
}) {
  const db = getFirestore();
  const paymentSnapshot = await db.collection("payments").doc(input.paymentIntentId).get();
  const payment = paymentSnapshot.data();

  if (!payment?.orderId) {
    return;
  }

  await db.collection("payments").doc(input.paymentIntentId).set(
    {
      disputeId: input.disputeId,
      disputeStatus: input.status ?? "needs_response",
      updatedAt: new Date(),
    },
    { merge: true },
  );

  await db.collection("orderEvents").doc(`payment-${input.paymentIntentId}-disputed`).set(
    {
      orderId: payment.orderId,
      type: "payment_dispute_created",
      fromStatus: null,
      toStatus: "disputed",
      message: "Stripe reported a payment dispute.",
      createdBy: "stripe",
      createdAt: new Date(),
    },
    { merge: true },
  );

  await writeAuditLog({
    actorId: "stripe",
    actorRole: "system",
    action: "payment.dispute_created",
    resourceType: "payment",
    resourceId: input.paymentIntentId,
    summary: `Stripe dispute created for order ${payment.orderNumber ?? payment.orderId}.`,
    metadata: {
      orderId: payment.orderId,
      paymentIntentId: input.paymentIntentId,
      disputeId: input.disputeId,
      status: input.status,
    },
  });
}

export const confirmOrderPayment = onCall<{ orderId: string }>(
  { secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before confirming payment.");
    }

    await assertCustomerUser(request.auth.uid);
    const orderId = requireString(request.data.orderId, "orderId");

    const db = getFirestore();
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnapshot = await orderRef.get();

    if (!orderSnapshot.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }

    const order = orderSnapshot.data();

    if (!order) {
      throw new HttpsError("not-found", "Order not found.");
    }

    if (order.customerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "This order belongs to another customer.");
    }

    if (order.paymentStatus === "paid") {
      return { status: "paid" };
    }

    if (typeof order.paymentId !== "string" || !order.paymentId) {
      throw new HttpsError(
        "failed-precondition",
        "No payment intent is attached to this order.",
      );
    }

    const paymentIntent = await getStripe().paymentIntents.retrieve(order.paymentId);

    if (paymentIntent.status !== "succeeded") {
      throw new HttpsError(
        "failed-precondition",
        `Payment is ${paymentIntent.status}.`,
      );
    }

    return await markStripePaymentSucceeded({
      paymentIntent,
      actorId: request.auth.uid,
      actorRole: "customer",
    });
  },
);

export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method not allowed.");
      return;
    }

    const signature = request.headers["stripe-signature"];
    const webhookSecret = stripeWebhookSecret.value();

    if (!signature || Array.isArray(signature)) {
      response.status(400).send("Missing Stripe signature.");
      return;
    }

    if (!webhookSecret) {
      response.status(500).send("Stripe webhook secret is not configured.");
      return;
    }

    let event: Stripe.Event;

    try {
      event = getStripe().webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid Stripe webhook signature.";
      response.status(400).send(`Webhook signature verification failed: ${message}`);
      return;
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        await markStripePaymentSucceeded({
          paymentIntent: event.data.object as Stripe.PaymentIntent,
          actorId: "stripe",
          actorRole: "system",
        });
      } else if (event.type === "payment_intent.payment_failed") {
        await markStripePaymentFailed(event.data.object as Stripe.PaymentIntent);
      } else if (event.type === "payment_intent.processing") {
        await markStripePaymentProcessing(event.data.object as Stripe.PaymentIntent);
      } else if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;

        if (paymentIntentId) {
          await markStripePaymentRefunded({
            paymentIntentId,
            amountRefunded: charge.amount_refunded,
            status:
              charge.amount_refunded >= charge.amount
                ? "refunded"
                : "partially_refunded",
          });
        }
      } else if (event.type === "refund.created" || event.type === "refund.updated") {
        const refund = event.data.object as Stripe.Refund;
        const paymentIntentId =
          typeof refund.payment_intent === "string" ? refund.payment_intent : null;

        if (paymentIntentId) {
          await markStripePaymentRefunded({
            paymentIntentId,
            amountRefunded: refund.amount,
            refundId: refund.id,
            status: refund.status ?? "refunded",
          });
        }
      } else if (event.type === "charge.dispute.created") {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === "string" ? dispute.charge : null;

        if (chargeId) {
          const charge = await getStripe().charges.retrieve(chargeId);
          const paymentIntentId =
            typeof charge.payment_intent === "string" ? charge.payment_intent : null;

          if (paymentIntentId) {
            await markStripePaymentDisputed({
              paymentIntentId,
              disputeId: dispute.id,
              status: dispute.status,
            });
          }
        }
      }

      response.status(200).json({ received: true });
    } catch (error) {
      if (shouldIgnoreStripeWebhookError(error)) {
        logIgnoredStripeWebhook(event, error);
        response.status(200).json({ ignored: true, received: true });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to process Stripe webhook.";
      console.error("Stripe webhook processing failed", {
        eventId: event.id,
        eventType: event.type,
        message,
      });
      response.status(500).send(message);
    }
  },
);

type OrderEvent = {
  orderId?: string;
  type?: string;
  toStatus?: string | null;
  message?: string;
};

type OrderRecord = {
  customerId?: string;
  customerName?: string;
  assignedPickupDriverId?: string | null;
  assignedDeliveryDriverId?: string | null;
};

type UserRecord = {
  active?: boolean;
  displayName?: string;
  expoPushTokens?: string[];
  notificationPreferences?: Partial<typeof defaultNotificationPreferences>;
};

type NotificationPreferenceKey = keyof typeof defaultNotificationPreferences;

function getNotificationContent(event: OrderEvent, order: OrderRecord) {
  if (event.type === "order_created") {
    return {
      title: "New laundry request",
      body: `${order.customerName ?? "A customer"} submitted an order request.`,
    };
  }

  if (event.type === "batch_assigned") {
    return {
      title: "New driver batch",
      body: event.message ?? "A batch was assigned to you.",
    };
  }

  if (event.type === "price_set") {
    return {
      title: "Your laundry order is ready for payment",
      body: event.message ?? "The owner set your final price.",
    };
  }

  if (event.type === "payment_completed") {
    return {
      title: "Payment received",
      body: `${order.customerName ?? "A customer"} completed payment.`,
    };
  }

  if (event.type === "payment_processing") {
    return {
      title: "Payment processing",
      body: event.message ?? "Your payment is still processing.",
    };
  }

  if (event.type === "payment_failed") {
    return {
      title: "Payment did not go through",
      body: event.message ?? "Your payment was not completed.",
    };
  }

  if (event.type === "payment_refunded") {
    return {
      title: "Payment refund recorded",
      body: `${order.customerName ?? "A customer"} has a refund recorded.`,
    };
  }

  if (event.type === "payment_dispute_created") {
    return {
      title: "Payment dispute opened",
      body: `${order.customerName ?? "A customer"} has a Stripe dispute that needs review.`,
    };
  }

  return {
    title: "Laundry order update",
    body: event.message ?? "Your laundry order status changed.",
  };
}

async function getOwnerUserIds() {
  const snapshot = await getFirestore()
    .collection("users")
    .where("role", "==", "owner")
    .where("active", "==", true)
    .get();

  return snapshot.docs.map((docSnapshot) => docSnapshot.id);
}

function getNotificationPreferenceKey(event: OrderEvent): NotificationPreferenceKey {
  if (event.type === "order_created") {
    return "ownerNewRequests";
  }

  if (
    event.type === "payment_completed"
    || event.type === "payment_refunded"
    || event.type === "payment_dispute_created"
  ) {
    return "ownerPaymentUpdates";
  }

  if (event.type === "batch_assigned") {
    return "driverAssignedRoutes";
  }

  return "customerOrderUpdates";
}

async function getPushTokensForUsers(
  userIds: string[],
  preferenceKey: NotificationPreferenceKey,
) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const userSnapshot = await getFirestore().collection("users").doc(userId).get();
      const user = userSnapshot.data() as UserRecord | undefined;
      const preferences = {
        ...defaultNotificationPreferences,
        ...(user?.notificationPreferences ?? {}),
      };

      if (!user || user.active === false || preferences[preferenceKey] === false) {
        return [];
      }

      return user.expoPushTokens ?? [];
    }),
  );

  return [...new Set(users.flat().filter(Boolean))];
}

async function sendExpoPushNotifications(input: {
  tokens: string[];
  title: string;
  body: string;
  url: string;
}) {
  if (input.tokens.length === 0) {
    return;
  }

  const messages = input.tokens.map((token) => ({
    to: token,
    sound: "default",
    title: input.title,
    body: input.body,
    data: {
      url: input.url,
    },
  }));

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
}

export const sendOrderEventNotification = onDocumentCreated(
  "orderEvents/{eventId}",
  async (event) => {
    const orderEvent = event.data?.data() as OrderEvent | undefined;

    if (!orderEvent?.orderId) {
      return;
    }

    const db = getFirestore();
    const orderSnapshot = await db.collection("orders").doc(orderEvent.orderId).get();
    const order = orderSnapshot.data() as OrderRecord | undefined;

    if (!order) {
      return;
    }

    let recipientUserIds: string[] = [];
    let url = `/(customer)/orders/${orderEvent.orderId}`;

    if (
      orderEvent.type === "order_created"
      || orderEvent.type === "payment_completed"
      || orderEvent.type === "payment_refunded"
      || orderEvent.type === "payment_dispute_created"
    ) {
      recipientUserIds = await getOwnerUserIds();
      url = `/(admin)/orders/${orderEvent.orderId}`;
    } else if (orderEvent.type === "batch_assigned") {
      const driverId =
        orderEvent.toStatus === "delivery_assigned"
          ? order.assignedDeliveryDriverId
          : order.assignedPickupDriverId;
      recipientUserIds = driverId ? [driverId] : [];
      url = "/(driver)/batches";
    } else if (order.customerId) {
      recipientUserIds = [order.customerId];
    }

    const preferenceKey = getNotificationPreferenceKey(orderEvent);
    const tokens = await getPushTokensForUsers(recipientUserIds, preferenceKey);
    const content = getNotificationContent(orderEvent, order);

    await sendExpoPushNotifications({
      tokens,
      title: content.title,
      body: content.body,
      url,
    });
  },
);
