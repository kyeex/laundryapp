import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { serviceCatalog } from "@/data/serviceCatalog";
import { getAdminBatches, getEligibleOrdersForBatch } from "@/services/batchService";
import { getAdminOrders, getOrderNumber } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import {
  formatOrderStatus,
  orderStatusGroups,
} from "@/workflows/orderWorkflow";

type SortKey =
  | "number"
  | "customer"
  | "type"
  | "status"
  | "schedule"
  | "total"
  | "payment";
type SortDirection = "asc" | "desc";

const orderTypeFilters = [
  { label: "All types", value: "all" },
  { label: "Wash and fold", value: "wash-fold" },
  { label: "Wash + dry cleaning", value: "wash-fold-dry-cleaning" },
] as const;

const pickupWindowFilters = [
  { label: "All pickup windows", value: "all" },
  { label: "9AM-12PM", value: "9:00 AM - 12:00 PM" },
  { label: "12PM-3PM", value: "12:00 PM - 3:00 PM" },
  { label: "3PM-6PM", value: "3:00 PM - 6:00 PM" },
] as const;

const dashboardAttentionFilters = {
  "new-requests": {
    label: "New requests",
    description: "Orders waiting for an owner to accept or decline.",
  },
  "price-payment": {
    label: "Price/payment",
    description: "Orders needing final pricing or payment follow-up.",
  },
  "pickup-ready": {
    label: "Pickup ready",
    description: "Accepted orders that can be added to a pickup batch.",
  },
  "delivery-ready": {
    label: "Delivery ready",
    description: "Orders that can be added to a delivery batch.",
  },
  "submitted-routes": {
    label: "Submitted routes",
    description: "Orders included in driver-submitted routes.",
  },
} as const;

type DashboardAttentionFilter = keyof typeof dashboardAttentionFilters;

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDashboardAttentionFilter(value: string | string[] | undefined) {
  const filter = Array.isArray(value) ? value[0] : value;

  return filter && filter in dashboardAttentionFilters
    ? (filter as DashboardAttentionFilter)
    : null;
}

function getStatusGroupForDashboardAttention(
  filter: DashboardAttentionFilter | null,
) {
  if (filter === "new-requests") {
    return "New";
  }

  if (filter === "pickup-ready") {
    return "Accepted";
  }

  if (filter === "delivery-ready") {
    return "Delivery";
  }

  return null;
}

function getAttentionFilterForDashboardRoute(
  filter: DashboardAttentionFilter | null,
) {
  return filter === "pickup-ready" || filter === "delivery-ready" ? null : filter;
}

function getSubmittedRouteOrderIds(batches: Batch[]) {
  return new Set(
    batches
      .filter((batch) => batch.status === "completed")
      .flatMap((batch) => batch.orderIds),
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getInitialCalendarMonth(value: string) {
  if (isValidIsoDate(value)) {
    return new Date(`${value}T12:00:00`);
  }

  return new Date();
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (string | null)[] = Array.from({ length: firstDay.getDay() }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(toIsoDate(new Date(year, month, day, 12)));
  }

  return days;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T12:00:00`);

  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

function matchesDateRange(order: Order, startDate: string, endDate: string) {
  const hasStartDate = isValidIsoDate(startDate);
  const hasEndDate = isValidIsoDate(endDate);

  if (!hasStartDate && !hasEndDate) {
    return true;
  }

  const orderDates = [order.scheduledPickupDate, order.scheduledDropoffDate].filter(
    isValidIsoDate,
  );

  return orderDates.some((orderDate) => {
    const afterStart = hasStartDate ? orderDate >= startDate : true;
    const beforeEnd = hasEndDate ? orderDate <= endDate : true;

    return afterStart && beforeEnd;
  });
}

function getServiceNames(order: Order) {
  return (
    order.selectedServiceIds
      .map((serviceId) => serviceCatalog.find((service) => service.id === serviceId)?.name)
      .filter(Boolean)
      .join(", ") || "Service not found"
  );
}

function getOrderType(order: Order) {
  const hasDryCleaning = order.selectedServiceIds.includes("wash-fold-dry-cleaning");
  const addOnCount = order.selectedAddOns.length;

  if (hasDryCleaning) {
    return `Wash/fold + dry cleaning · ${order.selectedDryCleaningItems.length} dry item${
      order.selectedDryCleaningItems.length === 1 ? "" : "s"
    }`;
  }

  return `Wash/fold · ${addOnCount} add-on${addOnCount === 1 ? "" : "s"}`;
}

function getSortValue(order: Order, sortKey: SortKey) {
  if (sortKey === "number") {
    return getOrderNumber(order);
  }

  if (sortKey === "customer") {
    return order.customerName || "Customer";
  }

  if (sortKey === "type") {
    return getServiceNames(order);
  }

  if (sortKey === "status") {
    return order.status;
  }

  if (sortKey === "schedule") {
    return `${order.scheduledPickupDate} ${order.scheduledPickupWindow}`;
  }

  if (sortKey === "total") {
    return order.estimatedSubtotal;
  }

  return order.paymentStatus;
}

function compareOrders(a: Order, b: Order, sortKey: SortKey, direction: SortDirection) {
  const first = getSortValue(a, sortKey);
  const second = getSortValue(b, sortKey);
  const comparison =
    typeof first === "number" && typeof second === "number"
      ? first - second
      : String(first).localeCompare(String(second));

  return direction === "asc" ? comparison : comparison * -1;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value: number | null) {
  return value === null ? "Final pending" : `$${value.toFixed(2)}`;
}

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getTopCountLabel(counts: Record<string, number>, fallback: string) {
  const topEntry = Object.entries(counts).sort((firstEntry, secondEntry) => {
    const countComparison = secondEntry[1] - firstEntry[1];

    return countComparison === 0
      ? firstEntry[0].localeCompare(secondEntry[0])
      : countComparison;
  })[0];

  return topEntry ? `${topEntry[0]} (${topEntry[1]})` : fallback;
}

function incrementCount(counts: Record<string, number>, key: string) {
  if (!key) {
    return counts;
  }

  return {
    ...counts,
    [key]: (counts[key] ?? 0) + 1,
  };
}

function getOrderRevenueValue(order: Order) {
  return order.finalPrice ?? order.estimatedSubtotal;
}

function buildOrderAnalytics(orders: Order[]) {
  const totalRevenueEarned = orders.reduce(
    (total, order) =>
      order.paymentStatus === "paid" ? total + getOrderRevenueValue(order) : total,
    0,
  );
  const projectedRevenue = orders.reduce(
    (total, order) => total + getOrderRevenueValue(order),
    0,
  );
  const paidOrderCount = orders.filter((order) => order.paymentStatus === "paid").length;
  const completedOrderCount = orders.filter((order) => order.status === "completed").length;
  const pickupWindowCounts = orders.reduce<Record<string, number>>(
    (counts, order) => incrementCount(counts, order.scheduledPickupWindow),
    {},
  );
  const serviceCounts = orders.reduce<Record<string, number>>((counts, order) => {
    return order.selectedServiceIds.reduce(
      (nextCounts, serviceId) =>
        incrementCount(
          nextCounts,
          serviceCatalog.find((service) => service.id === serviceId)?.name ?? serviceId,
        ),
      counts,
    );
  }, {});
  const statusCounts = orders.reduce<Record<string, number>>(
    (counts, order) => incrementCount(counts, formatOrderStatus(order.status)),
    {},
  );
  const averageOrderValue = orders.length > 0 ? projectedRevenue / orders.length : 0;
  const paymentRate = orders.length > 0 ? paidOrderCount / orders.length : 0;
  const completionRate = orders.length > 0 ? completedOrderCount / orders.length : 0;
  const topStatuses = Object.entries(statusCounts)
    .sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1])
    .slice(0, 4);

  return {
    averageOrderValue,
    completionRate,
    paidOrderCount,
    paymentRate,
    projectedRevenue,
    topStatuses,
    totalOrders: orders.length,
    totalRevenueEarned,
    mostPopularPickupWindow: getTopCountLabel(
      pickupWindowCounts,
      "No pickup windows yet",
    ),
    mostPopularService: getTopCountLabel(serviceCounts, "No services yet"),
  };
}

function createExcelTable(orders: Order[]) {
  const headers = [
    "Order number",
    "Customer",
    "Phone",
    "Order type",
    "Services",
    "Status",
    "Pickup date",
    "Pickup window",
    "Drop-off date",
    "Drop-off window",
    "Estimated total",
    "Gratuity",
    "Payment status",
    "Final price",
    "Order ID",
  ];
  const rows = orders.map((order) => [
    getOrderNumber(order),
    order.customerName || "Customer",
    order.customerPhone,
    getOrderType(order),
    getServiceNames(order),
    formatOrderStatus(order.status),
    formatDisplayDate(order.scheduledPickupDate),
    order.scheduledPickupWindow,
    formatDisplayDate(order.scheduledDropoffDate),
    order.scheduledDropoffWindow,
    `$${order.estimatedSubtotal.toFixed(2)}`,
    `$${order.gratuityAmount.toFixed(2)}`,
    formatOrderStatus(order.paymentStatus),
    formatMoney(order.finalPrice),
    order.id,
  ]);
  const headerHtml = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join("");
  const rowsHtml = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(String(cell))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </body>
</html>`;
}

function downloadExcelFile(orders: Order[]) {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Excel export is available in the web preview.");
  }

  const today = toIsoDate(new Date());
  const blob = new Blob([createExcelTable(orders)], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `laundry-orders-${today}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type DatePickerFieldProps = {
  label: string;
  value: string;
  isOpen: boolean;
  onClear: () => void;
  onOpen: () => void;
  onSelect: (date: string) => void;
};

function DatePickerField({
  label,
  value,
  isOpen,
  onClear,
  onOpen,
  onSelect,
}: DatePickerFieldProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => getInitialCalendarMonth(value));
  const calendarDays = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1, 12),
    );
  }

  return (
    <View style={styles.datePickerField}>
      <Text style={styles.datePickerLabel}>{label}</Text>
      <Pressable
        onPress={onOpen}
        style={[styles.datePickerButton, isOpen && styles.datePickerButtonActive]}
      >
        <Text style={styles.datePickerButtonText}>
          {value ? formatDisplayDate(value) : "Select date"}
        </Text>
      </Pressable>
      {value ? (
        <Pressable onPress={onClear} style={styles.clearDateButton}>
          <Text style={styles.clearDateText}>Clear {label.toLowerCase()}</Text>
        </Pressable>
      ) : null}
      {isOpen ? (
        <View style={styles.calendarPanel}>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => moveMonth(-1)} style={styles.monthButton}>
              <Text style={styles.monthButtonText}>Previous</Text>
            </Pressable>
            <Text style={styles.calendarTitle}>{getMonthLabel(visibleMonth)}</Text>
            <Pressable onPress={() => moveMonth(1)} style={styles.monthButton}>
              <Text style={styles.monthButtonText}>Next</Text>
            </Pressable>
          </View>
          <View style={styles.weekdayGrid}>
            {weekdayLabels.map((weekday) => (
              <Text key={weekday} style={styles.weekdayLabel}>
                {weekday}
              </Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((date, index) =>
              date ? (
                <Pressable
                  key={date}
                  onPress={() => onSelect(date)}
                  style={[
                    styles.calendarDay,
                    value === date && styles.calendarDaySelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      value === date && styles.calendarDayTextSelected,
                    ]}
                  >
                    {Number(date.slice(-2))}
                  </Text>
                </Pressable>
              ) : (
                <View key={`empty-${index}`} style={styles.calendarDay} />
              ),
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function AdminOrdersScreen() {
  const searchParams = useLocalSearchParams<{ attention?: string | string[] }>();
  const initialAttentionFilter = getDashboardAttentionFilter(searchParams.attention);
  const initialSelectedAttentionFilter =
    getAttentionFilterForDashboardRoute(initialAttentionFilter);
  const [orders, setOrders] = useState<Order[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedAttentionFilter, setSelectedAttentionFilter] =
    useState<DashboardAttentionFilter | null>(() => initialSelectedAttentionFilter);
  const [selectedStatusGroup, setSelectedStatusGroup] = useState<string | null>(() =>
    getStatusGroupForDashboardAttention(initialAttentionFilter),
  );
  const [selectedOrderType, setSelectedOrderType] =
    useState<(typeof orderTypeFilters)[number]["value"]>("all");
  const [selectedPickupWindow, setSelectedPickupWindow] =
    useState<(typeof pickupWindowFilters)[number]["value"]>("all");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [openDatePicker, setOpenDatePicker] = useState<"start" | "end" | null>(null);
  const [areFiltersExpanded, setAreFiltersExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("schedule");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const incomingCount = useMemo(
    () => orders.filter((order) => order.status === "requested").length,
    [orders],
  );
  const statusSummary = useMemo(
    () =>
      orderStatusGroups.map((group) => ({
        ...group,
        count: orders.filter((order) => group.statuses.includes(order.status)).length,
      })),
    [orders],
  );
  const activeStatusGroup = orderStatusGroups.find(
    (group) => group.label === selectedStatusGroup,
  );
  const activeAttentionFilterConfig = selectedAttentionFilter
    ? dashboardAttentionFilters[selectedAttentionFilter]
    : null;
  const attentionFilteredOrderIds = useMemo(() => {
    if (!selectedAttentionFilter) {
      return null;
    }

    if (selectedAttentionFilter === "new-requests") {
      return new Set(
        orders.filter((order) => order.status === "requested").map((order) => order.id),
      );
    }

    if (selectedAttentionFilter === "price-payment") {
      return new Set(
        orders
          .filter(
            (order) =>
              order.status === "in_progress" ||
              (order.finalPrice !== null && order.paymentStatus !== "paid"),
          )
          .map((order) => order.id),
      );
    }

    if (selectedAttentionFilter === "pickup-ready") {
      return new Set(
        getEligibleOrdersForBatch(orders, "pickup").map((order) => order.id),
      );
    }

    if (selectedAttentionFilter === "delivery-ready") {
      return new Set(
        getEligibleOrdersForBatch(orders, "delivery").map((order) => order.id),
      );
    }

    return getSubmittedRouteOrderIds(batches);
  }, [batches, orders, selectedAttentionFilter]);
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesAttention = attentionFilteredOrderIds
          ? attentionFilteredOrderIds.has(order.id)
          : true;
        const matchesStatus = activeStatusGroup
          ? activeStatusGroup.statuses.includes(order.status)
          : true;
        const matchesType =
          selectedOrderType === "all"
            ? true
            : order.selectedServiceIds.includes(selectedOrderType);
        const matchesPickupWindow =
          selectedPickupWindow === "all"
            ? true
            : order.scheduledPickupWindow === selectedPickupWindow;
        const matchesDates = matchesDateRange(order, dateRangeStart, dateRangeEnd);

        return (
          matchesAttention &&
          matchesStatus &&
          matchesType &&
          matchesPickupWindow &&
          matchesDates
        );
      }),
    [
      activeStatusGroup,
      attentionFilteredOrderIds,
      dateRangeEnd,
      dateRangeStart,
      orders,
      selectedPickupWindow,
      selectedOrderType,
    ],
  );
  const sortedOrders = useMemo(
    () =>
      [...filteredOrders].sort((a, b) =>
        compareOrders(a, b, sortKey, sortDirection),
      ),
    [filteredOrders, sortDirection, sortKey],
  );
  const analytics = useMemo(() => buildOrderAnalytics(filteredOrders), [filteredOrders]);

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  function renderSortHeader(label: string, nextSortKey: SortKey, cellStyle: object) {
    const isActive = sortKey === nextSortKey;
    const arrowLabel = isActive ? (sortDirection === "asc" ? "↑" : "↓") : "↑↓";

    return (
      <Pressable
        accessibilityLabel={`Sort by ${label}`}
        accessibilityRole="button"
        onPress={() => handleSort(nextSortKey)}
        style={[cellStyle, styles.sortHeaderButton]}
      >
        <Text style={[styles.headerCell, isActive && styles.headerCellActive]}>
          {label}
        </Text>
        <Text style={[styles.sortArrow, isActive && styles.sortArrowActive]}>
          {arrowLabel}
        </Text>
      </Pressable>
    );
  }

  function handleExportOrders() {
    setError("");

    try {
      downloadExcelFile(sortedOrders);
    } catch (exportError) {
      const message =
        exportError instanceof Error
          ? exportError.message
          : "Unable to export orders right now.";
      setError(message);
    }
  }

  const hasDateRangeFilter = dateRangeStart.length > 0 || dateRangeEnd.length > 0;
  const hasActiveFilters =
    Boolean(selectedAttentionFilter) ||
    Boolean(selectedStatusGroup) ||
    selectedOrderType !== "all" ||
    selectedPickupWindow !== "all" ||
    hasDateRangeFilter;
  const activeFilterCount = [
    Boolean(selectedAttentionFilter),
    Boolean(selectedStatusGroup),
    selectedOrderType !== "all",
    selectedPickupWindow !== "all",
    hasDateRangeFilter,
  ].filter(Boolean).length;

  function handleToggleFilters() {
    setAreFiltersExpanded((current) => {
      if (current) {
        setOpenDatePicker(null);
      }

      return !current;
    });
  }

  const loadOrders = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [adminOrders, adminBatches] = await Promise.all([
        getAdminOrders(),
        getAdminBatches(),
      ]);
      setOrders(adminOrders);
      setBatches(adminBatches);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load orders right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const nextAttentionFilter = getDashboardAttentionFilter(searchParams.attention);

    setSelectedAttentionFilter(getAttentionFilterForDashboardRoute(nextAttentionFilter));
    setSelectedStatusGroup(getStatusGroupForDashboardAttention(nextAttentionFilter));
  }, [searchParams.attention]);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Orders</Text>
          <Text style={styles.body}>
            {incomingCount} incoming request{incomingCount === 1 ? "" : "s"} need
            review.
          </Text>
          <AppButton label="Refresh" onPress={loadOrders} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {orders.length > 0 ? (
          <View style={styles.statusGrid}>
            <Pressable
              onPress={() => {
                setSelectedAttentionFilter(null);
                setSelectedStatusGroup(null);
              }}
              style={[
                styles.statusTile,
                selectedStatusGroup === null && styles.statusTileActive,
              ]}
            >
              <Text style={styles.statusCount}>{orders.length}</Text>
              <Text style={styles.statusLabel}>All</Text>
            </Pressable>
            {statusSummary.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  setSelectedAttentionFilter(null);
                  setSelectedStatusGroup((current) =>
                    current === item.label ? null : item.label,
                  );
                }}
                style={[
                  styles.statusTile,
                  selectedStatusGroup === item.label && styles.statusTileActive,
                ]}
              >
                <Text style={styles.statusCount}>{item.count}</Text>
                <Text style={styles.statusLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {orders.length > 0 ? (
          <View style={styles.filterPanel}>
            <View style={styles.filterHeader}>
              <View style={styles.filterHeaderCopy}>
                <Text style={styles.filterTitle}>Filters</Text>
                <Text style={styles.filterMeta}>
                  Showing {filteredOrders.length} of {orders.length} order
                  {orders.length === 1 ? "" : "s"}.
                  {" "}Sorted by {sortKey}{" "}
                  {sortDirection === "asc" ? "ascending" : "descending"}.
                </Text>
              </View>
              <Pressable
                accessibilityLabel={
                  areFiltersExpanded ? "Collapse filters" : "Expand filters"
                }
                accessibilityRole="button"
                onPress={handleToggleFilters}
                style={styles.filterToggleButton}
              >
                <Text style={styles.filterToggleText}>
                  {areFiltersExpanded ? "-" : "+"}
                </Text>
              </Pressable>
            </View>
            {!areFiltersExpanded ? (
              <Text style={styles.filterCollapsedText}>
                {hasActiveFilters
                  ? `${activeFilterCount} active filter${
                      activeFilterCount === 1 ? "" : "s"
                    }. Open filters to adjust.`
                  : "Filter controls are hidden. Open filters to refine, export, or view analytics."}
              </Text>
            ) : null}
            {areFiltersExpanded ? (
              <>
                <View style={styles.filterActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={orders.length === 0}
                    onPress={() => setIsAnalyticsOpen(true)}
                    style={[
                      styles.analyticsButton,
                      orders.length === 0 && styles.analyticsButtonDisabled,
                    ]}
                  >
                    <Text style={styles.analyticsButtonText}>
                      View Analytics Report
                    </Text>
                  </Pressable>
                  <AppButton
                    disabled={sortedOrders.length === 0}
                    label="Export Excel"
                    onPress={handleExportOrders}
                    variant="secondary"
                  />
                  <AppButton
                    disabled={!hasActiveFilters}
                    label="Clear"
                    onPress={() => {
                      setSelectedAttentionFilter(null);
                      setSelectedStatusGroup(null);
                      setSelectedOrderType("all");
                      setSelectedPickupWindow("all");
                      setDateRangeStart("");
                      setDateRangeEnd("");
                      setOpenDatePicker(null);
                    }}
                    variant="secondary"
                  />
                </View>
                {activeAttentionFilterConfig ? (
                  <View style={styles.attentionBanner}>
                    <View style={styles.attentionCopy}>
                      <Text style={styles.attentionLabel}>
                        Dashboard filter: {activeAttentionFilterConfig.label}
                      </Text>
                      <Text style={styles.attentionText}>
                        {activeAttentionFilterConfig.description}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setSelectedAttentionFilter(null)}
                      style={styles.attentionClearButton}
                    >
                      <Text style={styles.attentionClearText}>View all orders</Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.filterGrid}>
                  {orderTypeFilters.map((filter) => (
                    <Pressable
                      key={filter.value}
                      onPress={() => setSelectedOrderType(filter.value)}
                      style={[
                        styles.filterChip,
                        selectedOrderType === filter.value && styles.filterChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedOrderType === filter.value &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.filterSectionLabel}>Pickup window</Text>
                <View style={styles.filterGrid}>
                  {pickupWindowFilters.map((filter) => (
                    <Pressable
                      key={filter.value}
                      onPress={() => setSelectedPickupWindow(filter.value)}
                      style={[
                        styles.filterChip,
                        selectedPickupWindow === filter.value &&
                          styles.filterChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedPickupWindow === filter.value &&
                            styles.filterChipTextActive,
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.dateFilterGrid}>
                  <DatePickerField
                    isOpen={openDatePicker === "start"}
                    label="Start date"
                    onClear={() => setDateRangeStart("")}
                    onOpen={() =>
                      setOpenDatePicker((current) =>
                        current === "start" ? null : "start",
                      )
                    }
                    onSelect={(date) => {
                      setDateRangeStart(date);
                      setOpenDatePicker(null);
                    }}
                    value={dateRangeStart}
                  />
                  <DatePickerField
                    isOpen={openDatePicker === "end"}
                    label="End date"
                    onClear={() => setDateRangeEnd("")}
                    onOpen={() =>
                      setOpenDatePicker((current) =>
                        current === "end" ? null : "end",
                      )
                    }
                    onSelect={(date) => {
                      setDateRangeEnd(date);
                      setOpenDatePicker(null);
                    }}
                    value={dateRangeEnd}
                  />
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {!isLoading && orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              New customer requests will land here first. Switch to the customer
              demo role and submit an order, then return here to accept or decline
              it, set the final price, and prepare it for batching.
            </Text>
          </View>
        ) : null}

        {orders.length > 0 ? (
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              {renderSortHeader("Order #", "number", styles.orderNumberCell)}
              {renderSortHeader("Customer", "customer", styles.customerCell)}
              {renderSortHeader("Order type", "type", styles.typeCell)}
              {renderSortHeader("Status", "status", styles.statusCell)}
              {renderSortHeader("Schedule", "schedule", styles.scheduleCell)}
              {renderSortHeader("Total", "total", styles.totalCell)}
              {renderSortHeader("Payment", "payment", styles.paymentCell)}
            </View>
            {sortedOrders.length === 0 ? (
              <View style={styles.tableEmpty}>
                <Text style={styles.emptyTitle}>No matching orders</Text>
                <Text style={styles.emptyText}>
                  No orders match the current filters. Clear a filter, widen the
                  date range, or choose All to return to the full order list.
                </Text>
              </View>
            ) : null}
            {sortedOrders.map((order) => (
              <Pressable
                key={order.id}
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/orders/[orderId]",
                    params: { orderId: order.id },
                  })
                }
                style={[styles.tableRow, styles.tableLink]}
              >
                <View style={styles.orderNumberCell}>
                  <Text style={styles.primaryText}>{getOrderNumber(order)}</Text>
                </View>
                <View style={styles.customerCell}>
                  <Text style={styles.primaryText}>
                    {order.customerName || "Customer"}
                  </Text>
                  <Text style={styles.secondaryText}>{order.customerPhone}</Text>
                </View>
                <View style={styles.typeCell}>
                  <Text style={styles.primaryText}>{getServiceNames(order)}</Text>
                  <Text style={styles.secondaryText}>{getOrderType(order)}</Text>
                </View>
                <View style={styles.statusCell}>
                  <Text style={styles.statusPill}>{formatOrderStatus(order.status)}</Text>
                </View>
                <View style={styles.scheduleCell}>
                  <Text style={styles.primaryText}>
                    Pickup {formatDisplayDate(order.scheduledPickupDate)}
                  </Text>
                  <Text style={styles.secondaryText}>
                    {order.scheduledPickupWindow}
                  </Text>
                  <Text style={styles.secondaryText}>
                    Drop-off {formatDisplayDate(order.scheduledDropoffDate)}
                  </Text>
                </View>
                <View style={styles.totalCell}>
                  <Text style={styles.primaryText}>
                    ${order.estimatedSubtotal.toFixed(2)}
                  </Text>
                  <Text style={styles.secondaryText}>
                    Tip ${order.gratuityAmount.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.paymentCell}>
                  <Text style={styles.primaryText}>{formatOrderStatus(order.paymentStatus)}</Text>
                  <Text style={styles.secondaryText}>
                    {order.finalPrice === null
                      ? "Final pending"
                      : `Final $${order.finalPrice.toFixed(2)}`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Modal
          animationType="fade"
          onRequestClose={() => setIsAnalyticsOpen(false)}
          transparent
          visible={isAnalyticsOpen}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.analyticsModal}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalKicker}>Orders analytics</Text>
                  <Text style={styles.modalTitle}>Analytics report</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsAnalyticsOpen(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
              </View>
              <Text style={styles.modalBody}>
                Report based on {filteredOrders.length} currently visible order
                {filteredOrders.length === 1 ? "" : "s"}. Filters and date ranges on
                the Orders page are included.
              </Text>
              <ScrollView style={styles.modalScroll}>
                <View style={styles.analyticsGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Money earned</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(analytics.totalRevenueEarned)}
                    </Text>
                    <Text style={styles.metricNote}>
                      Paid orders using final price when available.
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Projected order value</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(analytics.projectedRevenue)}
                    </Text>
                    <Text style={styles.metricNote}>
                      Final price or customer estimate across visible orders.
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Average order</Text>
                    <Text style={styles.metricValue}>
                      {formatCurrency(analytics.averageOrderValue)}
                    </Text>
                    <Text style={styles.metricNote}>Average visible order value.</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricLabel}>Paid orders</Text>
                    <Text style={styles.metricValue}>
                      {analytics.paidOrderCount}/{analytics.totalOrders}
                    </Text>
                    <Text style={styles.metricNote}>
                      {formatPercent(analytics.paymentRate)} payment completion.
                    </Text>
                  </View>
                </View>

                <View style={styles.insightPanel}>
                  <Text style={styles.insightTitle}>Operational insights</Text>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Most popular pickup time</Text>
                    <Text style={styles.insightValue}>
                      {analytics.mostPopularPickupWindow}
                    </Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Most popular service</Text>
                    <Text style={styles.insightValue}>
                      {analytics.mostPopularService}
                    </Text>
                  </View>
                  <View style={styles.insightRow}>
                    <Text style={styles.insightLabel}>Completion rate</Text>
                    <Text style={styles.insightValue}>
                      {formatPercent(analytics.completionRate)}
                    </Text>
                  </View>
                </View>

                <View style={styles.insightPanel}>
                  <Text style={styles.insightTitle}>Status mix</Text>
                  {analytics.topStatuses.length === 0 ? (
                    <Text style={styles.modalMuted}>No status data available yet.</Text>
                  ) : null}
                  {analytics.topStatuses.map(([status, count]) => (
                    <View key={status} style={styles.statusMetricRow}>
                      <Text style={styles.statusMetricLabel}>{status}</Text>
                      <View style={styles.statusMetricTrack}>
                        <View
                          style={[
                            styles.statusMetricFill,
                            {
                              width: `${Math.max(
                                8,
                                (count / Math.max(1, analytics.totalOrders)) * 100,
                              )}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.statusMetricCount}>{count}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  list: {
    gap: spacing.sm,
  },
  statusGrid: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  statusTile: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 128,
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 88,
    minWidth: 116,
    padding: spacing.md,
  },
  statusTileActive: {
    backgroundColor: "#EEF2FF",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  statusCount: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    textAlign: "center",
  },
  statusLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
  },
  filterPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  filterHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  filterHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  filterTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  filterActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  filterToggleButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    minHeight: 44,
    justifyContent: "center",
    width: 44,
  },
  filterToggleText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 26,
  },
  filterCollapsedText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  attentionBanner: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  attentionCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  attentionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  attentionText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  attentionClearButton: {
    backgroundColor: colors.surface,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attentionClearText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  analyticsButton: {
    alignItems: "center",
    backgroundColor: colors.text,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  analyticsButtonDisabled: {
    opacity: 0.55,
  },
  analyticsButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  filterMeta: {
    color: colors.muted,
    fontSize: 14,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterSectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dateFilterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    zIndex: 2,
  },
  datePickerField: {
    gap: spacing.xs,
    minWidth: 240,
    zIndex: 3,
  },
  datePickerLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  datePickerButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  datePickerButtonActive: {
    borderColor: colors.primary,
  },
  datePickerButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  clearDateButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
  clearDateText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  calendarPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    width: 320,
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  calendarTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  monthButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  monthButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  weekdayGrid: {
    flexDirection: "row",
  },
  weekdayLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    alignItems: "center",
    aspectRatio: 1,
    justifyContent: "center",
    width: "14.2857%",
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  calendarDayTextSelected: {
    color: colors.onPrimary,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 150,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 46,
    minWidth: 132,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
    textAlign: "center",
  },
  filterChipTextActive: {
    color: colors.onPrimary,
  },
  table: {
    backgroundColor: "#EAF7F4",
    borderColor: "#B7DED5",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    overflow: "hidden",
    padding: spacing.xs,
  },
  tableHeader: {
    backgroundColor: "#DDF1EC",
    borderColor: "#B7DED5",
    borderRadius: 8,
    borderWidth: 1,
  },
  tableLink: {
    backgroundColor: colors.surface,
    borderColor: "#D7E7E2",
    borderRadius: 8,
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  tableEmpty: {
    backgroundColor: colors.surface,
    borderColor: "#D7E7E2",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  sortHeaderButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  headerCell: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  headerCellActive: {
    color: colors.primary,
  },
  sortArrow: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  sortArrowActive: {
    color: colors.primary,
  },
  orderNumberCell: {
    flex: 0.95,
    minWidth: 124,
  },
  customerCell: {
    flex: 1.1,
    minWidth: 136,
  },
  typeCell: {
    flex: 1.5,
    minWidth: 180,
  },
  statusCell: {
    flex: 1,
    minWidth: 128,
  },
  scheduleCell: {
    flex: 1.35,
    minWidth: 172,
  },
  totalCell: {
    flex: 0.8,
    minWidth: 104,
  },
  paymentCell: {
    flex: 0.9,
    minWidth: 120,
  },
  primaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  secondaryText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2FF",
    color: colors.primary,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginTop: spacing.xs,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.md,
  },
  analyticsModal: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    maxHeight: "88%",
    maxWidth: 920,
    padding: spacing.lg,
    width: "100%",
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  modalKicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  modalBody: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  modalMuted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  modalScroll: {
    maxHeight: 560,
  },
  analyticsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 190,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
  },
  metricNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  insightPanel: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  insightTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  insightRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  insightValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  statusMetricRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusMetricLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 132,
    textTransform: "capitalize",
  },
  statusMetricTrack: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  statusMetricFill: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: "100%",
  },
  statusMetricCount: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "right",
  },
});
