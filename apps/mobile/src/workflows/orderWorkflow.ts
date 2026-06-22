import type { BatchType, Order, OrderStatus } from "@/types/domain";

export type OrderLifecycleStep = {
  id: string;
  title: string;
  description: string;
  statuses: OrderStatus[];
  owner?: "customer" | "owner" | "driver" | "system";
};

export type OwnerWorkflowAction = {
  label: string;
  status: OrderStatus;
  message: string;
};

export type OrderStatusGroup = {
  label: string;
  statuses: OrderStatus[];
};

export type OrderTimelineStep = {
  id: string;
  title: string;
  description: string;
  statuses: OrderStatus[];
};

export const orderLifecycleSteps: OrderLifecycleStep[] = [
  {
    id: "requested",
    title: "Request sent",
    description: "The order request has been submitted to the laundromat.",
    statuses: ["requested"],
    owner: "owner",
  },
  {
    id: "accepted",
    title: "Accepted",
    description: "The order has been accepted and is ready for pickup planning.",
    statuses: ["accepted", "pickup_assigned"],
    owner: "owner",
  },
  {
    id: "picked-up",
    title: "Picked up",
    description: "The laundry has been picked up and is headed to the store.",
    statuses: ["picked_up"],
    owner: "driver",
  },
  {
    id: "at-laundromat",
    title: "At laundromat",
    description: "The order has been received and service is underway.",
    statuses: ["received_at_store", "in_progress"],
    owner: "owner",
  },
  {
    id: "payment",
    title: "Price and payment",
    description: "Final price is confirmed and payment is ready or complete.",
    statuses: ["priced", "payment_requested", "paid"],
    owner: "owner",
  },
  {
    id: "ready-for-delivery",
    title: "Ready for delivery",
    description: "The clean order is ready to be sent back to the customer.",
    statuses: ["ready_for_delivery", "delivery_assigned", "out_for_delivery"],
    owner: "owner",
  },
  {
    id: "completed",
    title: "Completed",
    description: "The order has been delivered or completed.",
    statuses: ["delivered", "completed"],
    owner: "system",
  },
];

export const orderTimelineSteps: OrderTimelineStep[] = [
  {
    id: "requested",
    title: "Requested",
    description: "The customer submitted the order request.",
    statuses: ["requested"],
  },
  {
    id: "accepted",
    title: "Accepted",
    description: "The laundromat accepted the order and can prepare pickup.",
    statuses: ["accepted", "pickup_assigned"],
  },
  {
    id: "picked-up",
    title: "Picked up",
    description: "The laundry has been picked up from the customer.",
    statuses: ["picked_up"],
  },
  {
    id: "cleaning",
    title: "Cleaning",
    description: "The order is at the laundromat for service, pricing, and payment.",
    statuses: ["received_at_store", "in_progress", "priced", "payment_requested", "paid"],
  },
  {
    id: "ready-for-delivery",
    title: "Ready for delivery",
    description: "The clean order is ready to go back to the customer.",
    statuses: ["ready_for_delivery", "delivery_assigned", "out_for_delivery"],
  },
  {
    id: "delivered",
    title: "Delivered",
    description: "The order has been delivered back to the customer.",
    statuses: ["delivered"],
  },
  {
    id: "completed",
    title: "Completed",
    description: "The order is closed out.",
    statuses: ["completed"],
  },
];

export const stoppedOrderStatuses: OrderStatus[] = [
  "declined",
  "cancelled",
  "failed_pickup",
  "failed_delivery",
];

export const orderStatusGroups: OrderStatusGroup[] = [
  { label: "New", statuses: ["requested"] },
  { label: "Accepted", statuses: ["accepted", "pickup_assigned"] },
  { label: "In service", statuses: ["picked_up", "received_at_store", "in_progress"] },
  { label: "Payment", statuses: ["priced", "payment_requested", "paid"] },
  {
    label: "Delivery",
    statuses: ["ready_for_delivery", "delivery_assigned", "out_for_delivery"],
  },
  { label: "Closed", statuses: ["delivered", "completed", "declined", "cancelled"] },
  { label: "Issue", statuses: ["failed_pickup", "failed_delivery"] },
];

export const initialOrderDecisionActions: Array<
  OwnerWorkflowAction & { status: Extract<OrderStatus, "accepted" | "declined"> }
> = [
  {
    label: "Accept order",
    status: "accepted",
    message: "Order request accepted.",
  },
  {
    label: "Decline order",
    status: "declined",
    message: "Order request declined.",
  },
];

export const ownerOrderWorkflowActions: OwnerWorkflowAction[] = [
  {
    label: "Mark received at store",
    status: "received_at_store",
    message: "Order marked received at store.",
  },
  {
    label: "Start processing",
    status: "in_progress",
    message: "Order processing started.",
  },
  {
    label: "Mark ready for delivery",
    status: "ready_for_delivery",
    message: "Order marked ready for delivery.",
  },
  {
    label: "Complete order",
    status: "completed",
    message: "Order completed.",
  },
];

export const pickupBatchEligibleStatuses: OrderStatus[] = ["accepted"];
export const deliveryBatchEligibleStatuses: OrderStatus[] = [
  "ready_for_delivery",
  "paid",
  "priced",
];

const orderStatusLabels: Record<OrderStatus, string> = {
  requested: "Request sent",
  accepted: "Accepted",
  declined: "Declined",
  pickup_assigned: "Pickup assigned",
  picked_up: "Picked up",
  received_at_store: "Received at store",
  in_progress: "In progress",
  priced: "Price confirmed",
  payment_requested: "Payment requested",
  paid: "Paid",
  ready_for_delivery: "Ready for delivery",
  delivery_assigned: "Delivery assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  failed_pickup: "Pickup issue",
  failed_delivery: "Delivery issue",
};

export function formatOrderStatus(status: string) {
  if (status in orderStatusLabels) {
    return orderStatusLabels[status as OrderStatus];
  }

  return status.replace(/_/g, " ");
}

export function getOrderLifecycleStepIndex(status: OrderStatus) {
  const stepIndex = orderLifecycleSteps.findIndex((step) =>
    step.statuses.includes(status),
  );

  return stepIndex === -1 ? 0 : stepIndex;
}

export function getOrderTimelineStepIndex(status: OrderStatus) {
  const stepIndex = orderTimelineSteps.findIndex((step) =>
    step.statuses.includes(status),
  );

  return stepIndex === -1 ? 0 : stepIndex;
}

export function isStoppedOrderStatus(status: OrderStatus) {
  return stoppedOrderStatuses.includes(status);
}

export function canShowOwnerWorkflowActions(status: OrderStatus) {
  return !["requested", "declined", "cancelled", "completed"].includes(status);
}

export function canShowFinalPriceControls(status: OrderStatus) {
  return [
    "in_progress",
    "priced",
    "payment_requested",
    "paid",
    "ready_for_delivery",
    "delivery_assigned",
    "out_for_delivery",
    "delivered",
    "completed",
  ].includes(status);
}

export function getOrderAssignmentType(
  order: Order,
): Exclude<BatchType, "pickup_delivery"> | null {
  if (pickupBatchEligibleStatuses.includes(order.status) && !order.pickupBatchId) {
    return "pickup";
  }

  if (
    deliveryBatchEligibleStatuses.includes(order.status) &&
    !order.deliveryBatchId
  ) {
    return "delivery";
  }

  return null;
}

export function getAssignmentStatus(type: Exclude<BatchType, "pickup_delivery">) {
  return type === "pickup" ? "pickup_assigned" : "delivery_assigned";
}

export function getOrderBatchType(order: Order): Exclude<BatchType, "pickup_delivery"> {
  return deliveryBatchEligibleStatuses.includes(order.status) ||
    order.status === "delivery_assigned" ||
    order.status === "out_for_delivery" ||
    order.status === "delivered"
    ? "delivery"
    : "pickup";
}
