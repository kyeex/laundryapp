import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { SelectableOption } from "@/components/SelectableOption";
import { useAuth } from "@/context/AuthContext";
import {
  createBatch,
  getAdminBatches,
  getEligibleOrdersForBatch,
} from "@/services/batchService";
import { formatAddress, getAdminOrders } from "@/services/orderService";
import { getActiveDrivers } from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AppUser, Batch, BatchType, Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import {
  formatOrderStatus,
  getOrderBatchType as getWorkflowOrderBatchType,
} from "@/workflows/orderWorkflow";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function reorderIds(ids: string[], fromIndex: number, toIndex: number) {
  const boundedToIndex = Math.max(0, Math.min(ids.length - 1, toIndex));
  const nextIds = [...ids];
  const [movedId] = nextIds.splice(fromIndex, 1);

  nextIds.splice(boundedToIndex, 0, movedId);

  return nextIds;
}

function sortSelectedIdsByOrder(selectedIds: string[], orderedIds: string[]) {
  const selectedIdSet = new Set(selectedIds);

  return orderedIds.filter((orderId) => selectedIdSet.has(orderId));
}

function formatBatchType(type: BatchType) {
  if (type === "pickup_delivery") {
    return "Pick Up + Delivery";
  }

  return type === "pickup" ? "Pickup" : "Delivery";
}

function getOrderBatchType(order: Order): BatchType {
  return getWorkflowOrderBatchType(order);
}

function getOrderSchedule(order: Order, orderBatchType: BatchType) {
  return orderBatchType === "delivery"
    ? `${formatDisplayDate(order.scheduledDropoffDate)} · ${order.scheduledDropoffWindow}`
    : `${formatDisplayDate(order.scheduledPickupDate)} · ${order.scheduledPickupWindow}`;
}

function getBatchOrderType(batch: Batch, order: Order): BatchType {
  if (batch.type !== "pickup_delivery") {
    return batch.type;
  }

  return order.deliveryBatchId === batch.id ? "delivery" : "pickup";
}

function getEligibleEmptyText(type: BatchType) {
  if (type === "pickup") {
    return "Accepted orders appear here after the owner approves a customer request. Go to Orders, open a new request, and choose Accept order to make it batch-ready.";
  }

  if (type === "delivery") {
    return "Delivery orders appear here after an order is processed and marked ready for delivery. Open the order detail page, move it through processing, then mark it ready.";
  }

  return "Pickup + Delivery combines accepted pickup orders and ready delivery orders. If this list is empty, accept a new order or move an in-progress order to ready for delivery.";
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

type DraggableOrderOptionProps = {
  description: string;
  isDragging: boolean;
  meta: string;
  onDragEnd: () => void;
  onDragEnterOrder: (orderId: string, targetIndex: number) => void;
  onDragStartOrder: (orderId: string) => void;
  onPress: () => void;
  order: Order;
  position: number;
  selected: boolean;
};

function DraggableOrderOption({
  description,
  isDragging,
  meta,
  onDragEnd,
  onDragEnterOrder,
  onDragStartOrder,
  onPress,
  order,
  position,
  selected,
}: DraggableOrderOptionProps) {
  const dragStartYRef = useRef(0);
  const didDragRef = useRef(false);
  const lastTargetIndexRef = useRef(position - 1);

  useEffect(() => {
    if (!isDragging || typeof document === "undefined") {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      const deltaY = event.clientY - dragStartYRef.current;

      if (Math.abs(deltaY) < 12) {
        return;
      }

      didDragRef.current = true;

      const offset = Math.round(deltaY / 72);
      const targetIndex = Math.max(0, Math.min(position - 1 + offset, 99));

      if (targetIndex !== lastTargetIndexRef.current) {
        lastTargetIndexRef.current = targetIndex;
        onDragEnterOrder(order.id, targetIndex);
      }
    }

    function handleMouseUp() {
      onDragEnd();
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onDragEnd, onDragEnterOrder, order.id, position]);

  const mouseProps = {
    onMouseDown: (event: { button?: number; clientY?: number; preventDefault?: () => void }) => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault?.();
      dragStartYRef.current = event.clientY ?? 0;
      didDragRef.current = false;
      lastTargetIndexRef.current = position - 1;
      onDragStartOrder(order.id);
    },
  } as unknown as Record<string, unknown>;
  const responderProps = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: (event: { nativeEvent?: { pageY?: number; clientY?: number } }) => {
      const nativeEvent = event.nativeEvent ?? {};

      dragStartYRef.current = nativeEvent.pageY ?? nativeEvent.clientY ?? 0;
      didDragRef.current = false;
      lastTargetIndexRef.current = position - 1;
      onDragStartOrder(order.id);
    },
    onResponderMove: (event: { nativeEvent?: { pageY?: number; clientY?: number } }) => {
      const nativeEvent = event.nativeEvent ?? {};
      const currentY = nativeEvent.pageY ?? nativeEvent.clientY ?? dragStartYRef.current;
      const deltaY = currentY - dragStartYRef.current;

      if (Math.abs(deltaY) < 12) {
        return;
      }

      didDragRef.current = true;

      const offset = Math.round(deltaY / 72);
      const targetIndex = Math.max(0, Math.min(position - 1 + offset, 99));

      if (targetIndex !== lastTargetIndexRef.current) {
        lastTargetIndexRef.current = targetIndex;
        onDragEnterOrder(order.id, targetIndex);
      }
    },
    onResponderRelease: onDragEnd,
    onResponderTerminate: onDragEnd,
  } as unknown as Record<string, unknown>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (didDragRef.current) {
          didDragRef.current = false;
          return;
        }

        onPress();
      }}
      style={[
        styles.draggableOrder,
        selected && styles.draggableOrderSelected,
        isDragging && styles.draggableOrderDragging,
      ]}
      {...mouseProps}
      {...responderProps}
    >
      <View style={styles.dragBadge}>
        <Text style={[styles.dragBadgeText, selected && styles.selectedText]}>
          {position}
        </Text>
      </View>
      <View style={styles.draggableTextWrap}>
        <Text style={[styles.draggableTitle, selected && styles.selectedText]}>
          {order.customerName || "Customer"}
        </Text>
        <Text
          style={[styles.draggableDescription, selected && styles.selectedMuted]}
        >
          {description}
        </Text>
      </View>
      <Text style={[styles.draggableMeta, selected && styles.selectedText]}>
        {meta}
      </Text>
    </Pressable>
  );
}

export default function AdminBatchesScreen() {
  const { currentUser } = useAuth();
  const [batchType, setBatchType] = useState<BatchType>("pickup");
  const [drivers, setDrivers] = useState<AppUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [orderedEligibleOrderIds, setOrderedEligibleOrderIds] = useState<string[]>(
    [],
  );
  const [draggingOrderId, setDraggingOrderId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [lastCreatedBatchId, setLastCreatedBatchId] = useState("");
  const [expandedBatchIds, setExpandedBatchIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const eligibleOrders = useMemo(
    () => getEligibleOrdersForBatch(orders, batchType),
    [batchType, orders],
  );
  const eligibleOrderIds = useMemo(
    () => eligibleOrders.map((order) => order.id),
    [eligibleOrders],
  );
  const orderedEligibleOrders = useMemo(() => {
    const eligibleOrderMap = new Map(eligibleOrders.map((order) => [order.id, order]));
    const orderedOrders = orderedEligibleOrderIds
      .map((orderId) => eligibleOrderMap.get(orderId))
      .filter((order): order is Order => Boolean(order));
    const orderedOrderIdSet = new Set(orderedOrders.map((order) => order.id));
    const newOrders = eligibleOrders.filter(
      (order) => !orderedOrderIdSet.has(order.id),
    );

    return [...orderedOrders, ...newOrders];
  }, [eligibleOrders, orderedEligibleOrderIds]);
  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const assignedBatches = useMemo(
    () => batches.filter((batch) => batch.status === "assigned"),
    [batches],
  );
  const otherBatches = useMemo(
    () => batches.filter((batch) => batch.status !== "assigned"),
    [batches],
  );

  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);

  const loadBatchData = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [adminOrders, activeDrivers, adminBatches] = await Promise.all([
        getAdminOrders(),
        getActiveDrivers(),
        getAdminBatches(),
      ]);

      setOrders(adminOrders);
      setDrivers(activeDrivers);
      setBatches(adminBatches);
      setSelectedDriverId((current) => current || activeDrivers[0]?.id || "");
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load batch data right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatchData();
  }, [loadBatchData]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [batchType]);

  useEffect(() => {
    setOrderedEligibleOrderIds((current) => {
      const eligibleIdSet = new Set(eligibleOrderIds);
      const retainedIds = current.filter((orderId) => eligibleIdSet.has(orderId));
      const addedIds = eligibleOrderIds.filter(
        (orderId) => !retainedIds.includes(orderId),
      );

      return [...retainedIds, ...addedIds];
    });
    setSelectedOrderIds((current) => {
      const eligibleIdSet = new Set(eligibleOrderIds);

      return sortSelectedIdsByOrder(
        current.filter((orderId) => eligibleIdSet.has(orderId)),
        eligibleOrderIds,
      );
    });
  }, [eligibleOrderIds]);

  function toggleOrder(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : sortSelectedIdsByOrder(
            [...current, orderId],
            orderedEligibleOrders.map((order) => order.id),
          ),
    );
  }

  function moveDraggedOrderToTarget(orderId: string, targetIndex: number) {
    if (!draggingOrderId || draggingOrderId !== orderId) {
      return;
    }

    setOrderedEligibleOrderIds((current) => {
      const fromIndex = current.indexOf(draggingOrderId);
      const toIndex = Math.max(0, Math.min(current.length - 1, targetIndex));

      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return current;
      }

      const nextIds = reorderIds(current, fromIndex, toIndex);

      setSelectedOrderIds((selectedIds) =>
        sortSelectedIdsByOrder(selectedIds, nextIds),
      );

      return nextIds;
    });
  }

  function toggleBatchDetails(batchId: string) {
    setExpandedBatchIds((current) =>
      current.includes(batchId)
        ? current.filter((id) => id !== batchId)
        : [...current, batchId],
    );
  }

  async function handleCreateBatch() {
    if (!currentUser || !selectedDriver) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const createdBatchId = await createBatch({
        type: batchType,
        driverId: selectedDriver.id,
        driverName: selectedDriver.displayName || selectedDriver.email,
        orderIds: selectedOrderIds,
        scheduledDate,
        notes,
        ownerId: currentUser.id,
      });

      setSuccess("Batch created and assigned. Review it under Assigned batches.");
      setLastCreatedBatchId(createdBatchId);
      setSelectedOrderIds([]);
      setScheduledDate("");
      setIsDatePickerOpen(false);
      setNotes("");
      await loadBatchData();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to create this batch right now.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const canCreate =
    Boolean(selectedDriver) &&
    selectedOrderIds.length > 0 &&
    isValidIsoDate(scheduledDate);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Batch management</Text>
          <Text style={styles.body}>
            Group accepted pickups or ready deliveries and assign them to a
            driver.
          </Text>
          <AppButton label="Refresh" onPress={loadBatchData} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batch type</Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <SelectableOption
                onPress={() => setBatchType("pickup")}
                selected={batchType === "pickup"}
                title="Pickup"
              />
            </View>
            <View style={styles.rowItem}>
              <SelectableOption
                onPress={() => setBatchType("delivery")}
                selected={batchType === "delivery"}
                title="Delivery"
              />
            </View>
            <View style={styles.rowItem}>
              <SelectableOption
                onPress={() => setBatchType("pickup_delivery")}
                selected={batchType === "pickup_delivery"}
                title="Pick Up + Delivery"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver</Text>
          {drivers.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineTitle}>No active drivers available</Text>
              <Text style={styles.muted}>
                Create or activate a driver in Admin user management before assigning
                a batch. Once a driver is active, they will appear here.
              </Text>
            </View>
          ) : null}
          {drivers.map((driver) => (
            <SelectableOption
              description={driver.phone || driver.email}
              key={driver.id}
              onPress={() => setSelectedDriverId(driver.id)}
              selected={selectedDriverId === driver.id}
              title={driver.displayName || driver.email}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <DatePickerField
            isOpen={isDatePickerOpen}
            label="Batch date"
            onClear={() => setScheduledDate("")}
            onOpen={() => setIsDatePickerOpen((current) => !current)}
            onSelect={(date) => {
              setScheduledDate(date);
              setIsDatePickerOpen(false);
            }}
            value={scheduledDate}
          />
          <Text style={isValidIsoDate(scheduledDate) ? styles.muted : styles.warning}>
            Select the date this batch should be assigned to the driver.
          </Text>
          <FormTextInput
            label="Driver notes"
            multiline
            onChangeText={setNotes}
            placeholder="Route notes, timing, or special handling..."
            style={styles.textArea}
            value={notes}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eligible orders</Text>
          {eligibleOrders.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineTitle}>No eligible orders right now</Text>
              <Text style={styles.muted}>{getEligibleEmptyText(batchType)}</Text>
            </View>
          ) : null}
          {orderedEligibleOrders.length > 1 ? (
            <Text style={styles.muted}>
              Click and drag an order block to arrange the driver stop order.
            </Text>
          ) : null}
          {orderedEligibleOrders.length === 1 ? (
            <Text style={styles.muted}>
              Add another eligible order to arrange the stop order.
            </Text>
          ) : null}
          {orderedEligibleOrders.map((order, index) => (
            <DraggableOrderOption
              description={`${getOrderSchedule(
                order,
                getOrderBatchType(order),
              )} · ${formatAddress(order.addressSnapshot)}`}
              isDragging={draggingOrderId === order.id}
              key={order.id}
              meta={
                batchType === "pickup_delivery"
                  ? `${formatBatchType(getOrderBatchType(order))} · ${formatOrderStatus(
                      order.status,
                    )}`
                  : formatOrderStatus(order.status)
              }
              onDragEnd={() => setDraggingOrderId("")}
              onDragEnterOrder={moveDraggedOrderToTarget}
              onDragStartOrder={setDraggingOrderId}
              onPress={() => toggleOrder(order.id)}
              order={order}
              position={index + 1}
              selected={selectedOrderIds.includes(order.id)}
            />
          ))}
        </View>

        <AppButton
          disabled={!canCreate || isSaving}
          label={isSaving ? "Creating..." : "Create and assign batch"}
          onPress={handleCreateBatch}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned batches</Text>
          {assignedBatches.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineTitle}>No assigned batches yet</Text>
              <Text style={styles.muted}>
                Select a driver, choose a batch date, pick at least one eligible
                order, then use Create and assign batch. New batches will appear
                here for owner review and driver access.
              </Text>
            </View>
          ) : null}
          {assignedBatches.map((batch) => {
            const isExpanded = expandedBatchIds.includes(batch.id);
            const isNewBatch = batch.id === lastCreatedBatchId;

            return (
              <View key={batch.id} style={[styles.card, isNewBatch && styles.newBatchCard]}>
                {isNewBatch ? (
                  <Text style={styles.newBatchLabel}>Just created</Text>
                ) : null}
                <Text style={styles.cardTitle}>
                  {formatBatchType(batch.type)} · {formatOrderStatus(batch.status)}
                </Text>
                <Text style={styles.muted}>
                  {batch.driverName || "Driver"} · {formatDisplayDate(batch.scheduledDate)}
                </Text>
                <Text style={styles.muted}>
                  {batch.orderIds.length} order
                  {batch.orderIds.length === 1 ? "" : "s"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => toggleBatchDetails(batch.id)}
                  style={styles.manifestToggle}
                >
                  <Text style={styles.manifestToggleText}>
                    {isExpanded ? "Hide included orders" : "View included orders"}
                  </Text>
                  <Text style={styles.manifestToggleIcon}>
                    {isExpanded ? "-" : "+"}
                  </Text>
                </Pressable>
                {isExpanded ? (
                  <View style={styles.batchManifest}>
                    <Text style={styles.manifestTitle}>Orders in this batch</Text>
                    {batch.orderIds.map((orderId) => {
                      const batchOrder = ordersById.get(orderId);

                      if (!batchOrder) {
                        return (
                          <Text key={orderId} style={styles.muted}>
                            {orderId} · order details unavailable
                          </Text>
                        );
                      }

                      const batchOrderType = getBatchOrderType(batch, batchOrder);

                      return (
                        <View key={orderId} style={styles.manifestItem}>
                          <Text style={styles.manifestCustomer}>
                            {batchOrder.customerName || "Customer"}
                          </Text>
                          <Text style={styles.muted}>
                            {formatBatchType(batchOrderType)} ·{" "}
                            {getOrderSchedule(batchOrder, batchOrderType)}
                          </Text>
                          <Text style={styles.muted}>
                            {formatAddress(batchOrder.addressSnapshot)}
                          </Text>
                          <Text style={styles.muted}>
                            {orderId} · {formatOrderStatus(batchOrder.status)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {otherBatches.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other batches</Text>
            {otherBatches.map((batch) => {
              const isExpanded = expandedBatchIds.includes(batch.id);

              return (
                <View key={batch.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {formatBatchType(batch.type)} · {formatOrderStatus(batch.status)}
                  </Text>
                  <Text style={styles.muted}>
                    {batch.driverName || "Driver"} · {formatDisplayDate(batch.scheduledDate)}
                  </Text>
                  <Text style={styles.muted}>
                    {batch.orderIds.length} order
                    {batch.orderIds.length === 1 ? "" : "s"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => toggleBatchDetails(batch.id)}
                    style={styles.manifestToggle}
                  >
                    <Text style={styles.manifestToggleText}>
                      {isExpanded ? "Hide included orders" : "View included orders"}
                    </Text>
                    <Text style={styles.manifestToggleIcon}>
                      {isExpanded ? "-" : "+"}
                    </Text>
                  </Pressable>
                  {isExpanded ? (
                    <View style={styles.batchManifest}>
                      <Text style={styles.manifestTitle}>Orders in this batch</Text>
                      {batch.orderIds.map((orderId) => {
                        const batchOrder = ordersById.get(orderId);

                        if (!batchOrder) {
                          return (
                            <Text key={orderId} style={styles.muted}>
                              {orderId} · order details unavailable
                            </Text>
                          );
                        }

                        const batchOrderType = getBatchOrderType(batch, batchOrder);

                        return (
                          <View key={orderId} style={styles.manifestItem}>
                            <Text style={styles.manifestCustomer}>
                              {batchOrder.customerName || "Customer"}
                            </Text>
                            <Text style={styles.muted}>
                              {formatBatchType(batchOrderType)} ·{" "}
                              {getOrderSchedule(batchOrder, batchOrderType)}
                            </Text>
                            <Text style={styles.muted}>
                              {formatAddress(batchOrder.addressSnapshot)}
                            </Text>
                            <Text style={styles.muted}>
                              {orderId} · {formatOrderStatus(batchOrder.status)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  textArea: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  datePickerField: {
    gap: spacing.xs,
    maxWidth: 340,
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
  draggableOrder: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 84,
    padding: spacing.md,
  },
  draggableOrderSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  draggableOrderDragging: {
    opacity: 0.6,
  },
  dragBadge: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dragBadgeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  draggableTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  draggableTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  draggableDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  draggableMeta: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedText: {
    color: colors.onPrimary,
  },
  selectedMuted: {
    color: "#D1FAE5",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  newBatchCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  newBatchLabel: {
    alignSelf: "flex-start",
    backgroundColor: "#D1FAE5",
    borderRadius: 8,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  batchManifest: {
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  manifestToggle: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  manifestToggleText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  manifestToggleIcon: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  manifestTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  manifestItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  emptyInline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyInlineTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  manifestCustomer: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  warning: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
});
