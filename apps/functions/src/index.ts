import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/firestore";
import { HttpsError, onCall } from "firebase-functions/https";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

initializeApp();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const currency = process.env.STRIPE_CURRENCY ?? "usd";
const stagingSeedTag = "staging-demo";
const stagingSeedPassword = "LaundryDemo#2026!";

const allowedRoles = new Set(["customer", "owner", "driver", "admin"]);
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
  if (!stripeSecretKey) {
    throw new HttpsError(
      "failed-precondition",
      "STRIPE_SECRET_KEY is not configured.",
    );
  }

  return new Stripe(stripeSecretKey);
}

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const db = getFirestore();
  await db.collection("users").doc(authUser.uid).set(user);

  if (role === "customer") {
    await db.collection("customerProfiles").doc(authUser.uid).set({
      userId: authUser.uid,
      defaultAddressId: null,
      notes: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (role === "driver") {
    await db.collection("driverProfiles").doc(authUser.uid).set({
      userId: authUser.uid,
      active: true,
      phone,
      vehicleInfo: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

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

export const createPaymentIntent = onCall<{ orderId: string }>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before paying.");
    }

    const { orderId } = request.data;

    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

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
      throw new HttpsError("failed-precondition", "This order is already paid.");
    }

    if (typeof order.finalPrice !== "number" || order.finalPrice <= 0) {
      throw new HttpsError(
        "failed-precondition",
        "The owner must set a final price before payment.",
      );
    }

    const amount = Math.round(order.finalPrice * 100);
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId,
        customerId: request.auth.uid,
      },
    });

    await orderRef.update({
      paymentStatus: "pending",
      paymentId: paymentIntent.id,
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

export const confirmOrderPayment = onCall<{ orderId: string }>(
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before confirming payment.");
    }

    const { orderId } = request.data;

    if (!orderId) {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

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

    await orderRef.update({
      paymentStatus: "paid",
      status: "paid",
      updatedAt: new Date(),
    });

    await db.collection("orderEvents").add({
      orderId,
      type: "payment_completed",
      fromStatus: order.status ?? null,
      toStatus: "paid",
      message: "Customer completed payment.",
      createdBy: request.auth.uid,
      createdAt: new Date(),
    });

    return { status: "paid" };
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
  displayName?: string;
  expoPushTokens?: string[];
};

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

async function getPushTokensForUsers(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const users = await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const userSnapshot = await getFirestore().collection("users").doc(userId).get();
      const user = userSnapshot.data() as UserRecord | undefined;

      return user?.expoPushTokens ?? [];
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

    if (orderEvent.type === "order_created" || orderEvent.type === "payment_completed") {
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

    const tokens = await getPushTokensForUsers(recipientUserIds);
    const content = getNotificationContent(orderEvent, order);

    await sendExpoPushNotifications({
      tokens,
      title: content.title,
      body: content.body,
      url,
    });
  },
);
