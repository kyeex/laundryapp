import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";
import {
  createDemoBatch,
  getDemoBatchById,
  getDemoBatches,
  getDemoOrders,
  updateDemoBatchStatus,
  updateDemoOrderStatus,
} from "@/data/demoStore";
import type {
  Batch,
  BatchStatus,
  BatchType,
  CreateBatchInput,
  Order,
  OrderStatus,
} from "@/types/domain";
import { validateCreateBatchInput } from "@/utils/validation";
import {
  getAssignmentStatus,
  getOrderAssignmentType,
  pickupBatchEligibleStatuses,
  deliveryBatchEligibleStatuses,
} from "@/workflows/orderWorkflow";

import { addOrderEvent, getAdminOrders, mapOrder } from "./orderService";
import { recordAuditLog } from "./auditLogService";

function mapBatch(id: string, data: DocumentData): Batch {
  return {
    id,
    type: data.type ?? "pickup",
    status: data.status ?? "draft",
    driverId: data.driverId ?? "",
    driverName: data.driverName ?? "",
    orderIds: data.orderIds ?? [],
    scheduledDate: data.scheduledDate ?? "",
    notes: data.notes ?? "",
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

function getAssignmentPatch(
  type: Exclude<BatchType, "pickup_delivery">,
  batchId: string,
  driverId: string,
): {
  pickupBatchId?: string;
  deliveryBatchId?: string;
  assignedPickupDriverId?: string;
  assignedDeliveryDriverId?: string;
  status: OrderStatus;
} {
  const status = getAssignmentStatus(type);

  if (type === "pickup") {
    return {
      pickupBatchId: batchId,
      assignedPickupDriverId: driverId,
      status,
    };
  }

  return {
    deliveryBatchId: batchId,
    assignedDeliveryDriverId: driverId,
    status,
  };
}

export async function createBatch(input: CreateBatchInput) {
  validateCreateBatchInput(input);

  const adminOrders = await getAdminOrders();
  const ordersById = new Map(adminOrders.map((order) => [order.id, order]));
  const orderAssignments = input.orderIds.map((orderId) => {
    const order = ordersById.get(orderId);
    const assignmentType = order ? getOrderAssignmentType(order) : null;

    if (
      !order ||
      !assignmentType ||
      (input.type !== "pickup_delivery" && assignmentType !== input.type)
    ) {
      throw new Error("Select only eligible orders for this batch type.");
    }

    return { order, assignmentType };
  });

  if (shouldUseDemoBackend) {
    return createDemoBatch(input);
  }

  const db = getFirebaseFirestore();
  const batchRef = await addDoc(collection(db, "batches"), {
    type: input.type,
    status: "assigned" satisfies BatchStatus,
    driverId: input.driverId,
    driverName: input.driverName,
    orderIds: input.orderIds,
    scheduledDate: input.scheduledDate.trim(),
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    orderAssignments.map(async ({ order, assignmentType }) => {
      const assignmentPatch = getAssignmentPatch(
        assignmentType,
        batchRef.id,
        input.driverId,
      );

      await updateDoc(doc(db, "orders", order.id), {
        ...assignmentPatch,
        updatedAt: serverTimestamp(),
      });

      await addOrderEvent({
        orderId: order.id,
        type: "batch_assigned",
        fromStatus: null,
        toStatus: assignmentPatch.status,
        message: `Order assigned to ${assignmentType} batch for ${input.driverName}.`,
        createdBy: input.ownerId,
      });
    }),
  );

  await recordAuditLog({
    actorId: input.ownerId,
    actorRole: "owner",
    action: "batch.created",
    resourceType: "batch",
    resourceId: batchRef.id,
    summary: `Created ${input.type} batch for ${input.driverName}.`,
    metadata: {
      batchType: input.type,
      driverId: input.driverId,
      orderIds: input.orderIds,
      scheduledDate: input.scheduledDate,
    },
  });

  return batchRef.id;
}

export async function getAdminBatches() {
  if (shouldUseDemoBackend) {
    return getDemoBatches();
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "batches"));

  return snapshot.docs
    .map((batchDoc) => mapBatch(batchDoc.id, batchDoc.data()))
    .sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;

      return bTime - aTime;
    });
}

export async function getDriverBatches(driverId: string) {
  if (shouldUseDemoBackend) {
    return getDemoBatches().filter((batch) => batch.driverId === driverId);
  }

  const db = getFirebaseFirestore();
  const batchesQuery = query(
    collection(db, "batches"),
    where("driverId", "==", driverId),
  );
  const snapshot = await getDocs(batchesQuery);

  return snapshot.docs
    .map((batchDoc) => mapBatch(batchDoc.id, batchDoc.data()))
    .sort((a, b) => {
      const aTime = a.createdAt?.getTime() ?? 0;
      const bTime = b.createdAt?.getTime() ?? 0;

      return bTime - aTime;
    });
}

export async function getBatchById(batchId: string) {
  if (shouldUseDemoBackend) {
    return getDemoBatchById(batchId);
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "batches", batchId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapBatch(snapshot.id, snapshot.data());
}

export async function getBatchOrders(batch: Batch) {
  if (shouldUseDemoBackend) {
    const orderIdSet = new Set(batch.orderIds);
    return getDemoOrders().filter((order) => orderIdSet.has(order.id));
  }

  const db = getFirebaseFirestore();
  const snapshots = await Promise.all(
    batch.orderIds.map((orderId) => getDoc(doc(db, "orders", orderId))),
  );

  return snapshots
    .filter((orderSnapshot) => orderSnapshot.exists())
    .map((orderSnapshot) => mapOrder(orderSnapshot.id, orderSnapshot.data()));
}

export function getEligibleOrdersForBatch(orders: Order[], type: BatchType) {
  if (type === "pickup_delivery") {
    return orders.filter((order) => Boolean(getOrderAssignmentType(order)));
  }

  if (type === "pickup") {
    return orders.filter(
      (order) =>
        pickupBatchEligibleStatuses.includes(order.status) && !order.pickupBatchId,
    );
  }

  return orders.filter(
    (order) =>
      deliveryBatchEligibleStatuses.includes(order.status) &&
      !order.deliveryBatchId,
  );
}

export async function updateBatchStatus(input: {
  batchId: string;
  status: BatchStatus;
  driverId?: string;
}) {
  if (shouldUseDemoBackend) {
    updateDemoBatchStatus(input);
    return;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "batches", input.batchId), {
    status: input.status,
    updatedAt: serverTimestamp(),
  });

  if (input.driverId) {
    await recordAuditLog({
      actorId: input.driverId,
      actorRole: "driver",
      action: "batch.route_submitted",
      resourceType: "batch",
      resourceId: input.batchId,
      summary: "Driver finalized and submitted a route.",
      metadata: {
        status: input.status,
      },
    });
  }
}

export async function updateDriverOrderStop(input: {
  batch: Batch;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  driverId: string;
}) {
  if (shouldUseDemoBackend) {
    updateDemoOrderStatus({
      orderId: input.orderId,
      toStatus: input.toStatus,
    });
    return;
  }

  const db = getFirebaseFirestore();

  await updateDoc(doc(db, "orders", input.orderId), {
    status: input.toStatus,
    updatedAt: serverTimestamp(),
  });

  await addOrderEvent({
    orderId: input.orderId,
    type: "driver_status_changed",
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    message: `Driver updated ${input.batch.type} stop to ${input.toStatus}.`,
    createdBy: input.driverId,
  });

  await recordAuditLog({
    actorId: input.driverId,
    actorRole: "driver",
    action: "order.driver_stop_updated",
    resourceType: "order",
    resourceId: input.orderId,
    summary: `Driver updated ${input.batch.type} stop from ${input.fromStatus} to ${input.toStatus}.`,
    metadata: {
      batchId: input.batch.id,
      batchType: input.batch.type,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
    },
  });
}
