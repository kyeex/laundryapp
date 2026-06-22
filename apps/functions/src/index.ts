import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/firestore";
import { HttpsError, onCall } from "firebase-functions/https";
import Stripe from "stripe";

initializeApp();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const currency = process.env.STRIPE_CURRENCY ?? "usd";

function getStripe() {
  if (!stripeSecretKey) {
    throw new HttpsError(
      "failed-precondition",
      "STRIPE_SECRET_KEY is not configured.",
    );
  }

  return new Stripe(stripeSecretKey);
}

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
