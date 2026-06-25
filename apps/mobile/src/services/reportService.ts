import { serviceCatalog } from "@/data/serviceCatalog";
import type { Batch, BatchType, Order } from "@/types/domain";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

export type ReportDateRange = {
  endDate: string;
  startDate: string;
};

export type RankedReportItem = {
  amount?: number;
  count: number;
  label: string;
  note?: string;
  percent?: number;
};

export type CustomerReportItem = {
  customerId: string;
  customerName: string;
  lastOrderDate: string;
  orderCount: number;
  paidRevenue: number;
  phone: string;
  projectedRevenue: number;
};

export type DriverReportItem = {
  assignedStops: number;
  completedBatches: number;
  completedStops: number;
  driverId: string;
  driverName: string;
  pickupStops: number;
  deliveryStops: number;
  routeCount: number;
  submittedRate: number;
};

export type OwnerBusinessReport = {
  activeCustomerCount: number;
  addOnLeaders: RankedReportItem[];
  averageOrderValue: number;
  completedOrderCount: number;
  completionRate: number;
  customerLeaders: CustomerReportItem[];
  dateRange: ReportDateRange;
  driverReports: DriverReportItem[];
  dryCleaningLeaders: RankedReportItem[];
  newCustomerCount: number;
  openOrderCount: number;
  paidOrderCount: number;
  paidRevenue: number;
  paymentRate: number;
  projectedRevenue: number;
  repeatCustomerCount: number;
  repeatCustomerRate: number;
  repeatCustomers: CustomerReportItem[];
  serviceLeaders: RankedReportItem[];
  statusBreakdown: RankedReportItem[];
  totalGratuity: number;
  totalOrders: number;
  unpaidBalance: number;
};

const completedStatuses = new Set(["completed", "delivered"]);
const stoppedStatuses = new Set([
  "cancelled",
  "declined",
  "failed_delivery",
  "failed_pickup",
]);
const pickupCompletedStatuses = new Set([
  "picked_up",
  "received_at_store",
  "in_progress",
  "priced",
  "payment_requested",
  "paid",
  "ready_for_delivery",
  "delivery_assigned",
  "out_for_delivery",
  "delivered",
  "completed",
]);
const deliveryCompletedStatuses = new Set(["delivered", "completed"]);

function getReportDate(order: Order) {
  if (order.createdAt) {
    return toIsoDate(order.createdAt);
  }

  return order.scheduledPickupDate || order.scheduledDropoffDate || "";
}

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isWithinRange(value: string, range: ReportDateRange) {
  if (!isValidIsoDate(value)) {
    return true;
  }

  const afterStart = isValidIsoDate(range.startDate) ? value >= range.startDate : true;
  const beforeEnd = isValidIsoDate(range.endDate) ? value <= range.endDate : true;

  return afterStart && beforeEnd;
}

function getOrderValue(order: Order) {
  return order.finalPrice ?? order.estimatedSubtotal;
}

function incrementCount(
  counts: Record<string, { amount: number; count: number; note?: string }>,
  key: string,
  amount = 0,
  note?: string,
) {
  if (!key) {
    return;
  }

  counts[key] = {
    amount: (counts[key]?.amount ?? 0) + amount,
    count: (counts[key]?.count ?? 0) + 1,
    note: note ?? counts[key]?.note,
  };
}

function countQuantityItem(
  counts: Record<string, { amount: number; count: number; note?: string }>,
  label: string,
  quantity: number,
  amount: number,
  note?: string,
) {
  if (!label) {
    return;
  }

  counts[label] = {
    amount: (counts[label]?.amount ?? 0) + amount,
    count: (counts[label]?.count ?? 0) + quantity,
    note: note ?? counts[label]?.note,
  };
}

function toRankedItems(
  counts: Record<string, { amount: number; count: number; note?: string }>,
  totalCount: number,
  limit = 6,
) {
  return Object.entries(counts)
    .map(([label, value]) => ({
      amount: value.amount,
      count: value.count,
      label,
      note: value.note,
      percent: totalCount > 0 ? value.count / totalCount : 0,
    }))
    .sort((firstItem, secondItem) => {
      const countComparison = secondItem.count - firstItem.count;

      return countComparison === 0
        ? firstItem.label.localeCompare(secondItem.label)
        : countComparison;
    })
    .slice(0, limit);
}

function getServiceName(serviceId: string) {
  return serviceCatalog.find((service) => service.id === serviceId)?.name ?? serviceId;
}

function isBatchInRange(batch: Batch, range: ReportDateRange) {
  if (!batch.scheduledDate) {
    return true;
  }

  return isWithinRange(batch.scheduledDate, range);
}

function getBatchStopType(batch: Batch, order: Order): BatchType {
  if (batch.type !== "pickup_delivery") {
    return batch.type;
  }

  return order.deliveryBatchId === batch.id ? "delivery" : "pickup";
}

function isStopCompleted(batch: Batch, order: Order) {
  const stopType = getBatchStopType(batch, order);

  return stopType === "delivery"
    ? deliveryCompletedStatuses.has(order.status)
    : pickupCompletedStatuses.has(order.status);
}

function buildCustomerReports(orders: Order[]) {
  const customers = new Map<string, CustomerReportItem>();

  orders.forEach((order) => {
    const customerId = order.customerId || order.customerName || "unknown-customer";
    const current = customers.get(customerId) ?? {
      customerId,
      customerName: order.customerName || "Customer",
      lastOrderDate: "",
      orderCount: 0,
      paidRevenue: 0,
      phone: order.customerPhone,
      projectedRevenue: 0,
    };
    const reportDate = getReportDate(order);

    customers.set(customerId, {
      ...current,
      customerName: order.customerName || current.customerName,
      lastOrderDate:
        reportDate && reportDate > current.lastOrderDate
          ? reportDate
          : current.lastOrderDate,
      orderCount: current.orderCount + 1,
      paidRevenue:
        current.paidRevenue +
        (order.paymentStatus === "paid" ? getOrderValue(order) : 0),
      phone: order.customerPhone || current.phone,
      projectedRevenue: current.projectedRevenue + getOrderValue(order),
    });
  });

  return Array.from(customers.values()).sort((firstCustomer, secondCustomer) => {
    const revenueComparison =
      secondCustomer.projectedRevenue - firstCustomer.projectedRevenue;

    return revenueComparison === 0
      ? secondCustomer.orderCount - firstCustomer.orderCount
      : revenueComparison;
  });
}

function buildDriverReports(
  batches: Batch[],
  ordersById: Map<string, Order>,
  range: ReportDateRange,
) {
  const drivers = new Map<string, DriverReportItem>();

  batches.filter((batch) => isBatchInRange(batch, range)).forEach((batch) => {
    const driverId = batch.driverId || batch.driverName || "unassigned-driver";
    const current = drivers.get(driverId) ?? {
      assignedStops: 0,
      completedBatches: 0,
      completedStops: 0,
      deliveryStops: 0,
      driverId,
      driverName: batch.driverName || "Unassigned driver",
      pickupStops: 0,
      routeCount: 0,
      submittedRate: 0,
    };
    const batchOrders = batch.orderIds
      .map((orderId) => ordersById.get(orderId))
      .filter((order): order is Order => Boolean(order));
    const pickupStops = batchOrders.filter(
      (order) => getBatchStopType(batch, order) === "pickup",
    ).length;
    const deliveryStops = batchOrders.length - pickupStops;
    const completedStops = batchOrders.filter((order) =>
      isStopCompleted(batch, order),
    ).length;
    const completedBatches =
      current.completedBatches + (batch.status === "completed" ? 1 : 0);
    const routeCount = current.routeCount + 1;

    drivers.set(driverId, {
      ...current,
      assignedStops: current.assignedStops + batchOrders.length,
      completedBatches,
      completedStops: current.completedStops + completedStops,
      deliveryStops: current.deliveryStops + deliveryStops,
      driverName: batch.driverName || current.driverName,
      pickupStops: current.pickupStops + pickupStops,
      routeCount,
      submittedRate: routeCount > 0 ? completedBatches / routeCount : 0,
    });
  });

  return Array.from(drivers.values()).sort((firstDriver, secondDriver) => {
    const stopComparison = secondDriver.assignedStops - firstDriver.assignedStops;

    return stopComparison === 0
      ? firstDriver.driverName.localeCompare(secondDriver.driverName)
      : stopComparison;
  });
}

export function buildOwnerBusinessReport(
  allOrders: Order[],
  allBatches: Batch[],
  dateRange: ReportDateRange,
): OwnerBusinessReport {
  const orders = allOrders.filter((order) => isWithinRange(getReportDate(order), dateRange));
  const totalOrders = orders.length;
  const ordersById = new Map(allOrders.map((order) => [order.id, order]));
  const paidRevenue = orders.reduce(
    (total, order) =>
      order.paymentStatus === "paid" ? total + getOrderValue(order) : total,
    0,
  );
  const projectedRevenue = orders.reduce(
    (total, order) => total + getOrderValue(order),
    0,
  );
  const totalGratuity = orders.reduce(
    (total, order) => total + order.gratuityAmount,
    0,
  );
  const paidOrderCount = orders.filter((order) => order.paymentStatus === "paid").length;
  const completedOrderCount = orders.filter((order) =>
    completedStatuses.has(order.status),
  ).length;
  const openOrderCount = orders.filter(
    (order) => !completedStatuses.has(order.status) && !stoppedStatuses.has(order.status),
  ).length;
  const serviceCounts: Record<string, { amount: number; count: number; note?: string }> =
    {};
  const addOnCounts: Record<string, { amount: number; count: number; note?: string }> =
    {};
  const dryCleaningCounts: Record<
    string,
    { amount: number; count: number; note?: string }
  > = {};
  const statusCounts: Record<string, { amount: number; count: number; note?: string }> =
    {};

  orders.forEach((order) => {
    order.selectedServiceIds.forEach((serviceId) => {
      incrementCount(serviceCounts, getServiceName(serviceId), getOrderValue(order));
    });
    order.selectedAddOns.forEach((addOn) => {
      const quantity = addOn.quantity ?? 1;
      countQuantityItem(
        addOnCounts,
        addOn.name,
        quantity,
        (addOn.price ?? 0) * quantity,
        addOn.price === null ? "Owner-priced" : undefined,
      );
    });
    order.selectedDryCleaningItems.forEach((item) => {
      const quantity = item.quantity ?? 1;
      countQuantityItem(
        dryCleaningCounts,
        item.name,
        quantity,
        item.price * quantity,
      );
    });
    incrementCount(statusCounts, formatOrderStatus(order.status));
  });

  const customerReports = buildCustomerReports(orders);
  const repeatCustomers = customerReports.filter((customer) => customer.orderCount > 1);

  return {
    activeCustomerCount: customerReports.length,
    addOnLeaders: toRankedItems(addOnCounts, orders.length),
    averageOrderValue: totalOrders > 0 ? projectedRevenue / totalOrders : 0,
    completedOrderCount,
    completionRate: totalOrders > 0 ? completedOrderCount / totalOrders : 0,
    customerLeaders: customerReports.slice(0, 6),
    dateRange,
    driverReports: buildDriverReports(allBatches, ordersById, dateRange).slice(0, 8),
    dryCleaningLeaders: toRankedItems(dryCleaningCounts, orders.length),
    newCustomerCount: customerReports.filter((customer) => customer.orderCount === 1)
      .length,
    openOrderCount,
    paidOrderCount,
    paidRevenue,
    paymentRate: totalOrders > 0 ? paidOrderCount / totalOrders : 0,
    projectedRevenue,
    repeatCustomerCount: repeatCustomers.length,
    repeatCustomerRate:
      customerReports.length > 0 ? repeatCustomers.length / customerReports.length : 0,
    repeatCustomers: repeatCustomers.slice(0, 8),
    serviceLeaders: toRankedItems(serviceCounts, orders.length),
    statusBreakdown: toRankedItems(statusCounts, orders.length, 10),
    totalGratuity,
    totalOrders,
    unpaidBalance: projectedRevenue - paidRevenue,
  };
}

export function getDefaultReportDateRange(): ReportDateRange {
  const end = new Date();
  const start = new Date();

  start.setDate(end.getDate() - 29);

  return {
    endDate: toIsoDate(end),
    startDate: toIsoDate(start),
  };
}

export function getPresetReportDateRange(days: number): ReportDateRange {
  const end = new Date();
  const start = new Date();

  start.setDate(end.getDate() - Math.max(0, days - 1));

  return {
    endDate: toIsoDate(end),
    startDate: toIsoDate(start),
  };
}
