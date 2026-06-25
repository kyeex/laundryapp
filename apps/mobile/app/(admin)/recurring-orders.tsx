import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import {
  getActiveRecurringOrders,
  type RecurringOrderFrequency,
  type RecurringOrderTemplate,
} from "@/services/recurringOrderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

function formatFrequency(value: RecurringOrderFrequency) {
  const labels: Record<RecurringOrderFrequency, string> = {
    every_two_weeks: "Every 2 weeks",
    monthly: "Monthly",
    weekly: "Weekly",
  };

  return labels[value] ?? "Weekly";
}

function formatPreferenceCount(order: RecurringOrderTemplate) {
  const addOnCount = order.selectedAddOns.reduce(
    (total, addOn) => total + (addOn.quantity ?? 1),
    0,
  );
  const dryCleaningCount = order.selectedDryCleaningItems.reduce(
    (total, item) => total + (item.quantity ?? 1),
    0,
  );
  const total = addOnCount + dryCleaningCount;

  return total > 0 ? `${total} saved preference${total === 1 ? "" : "s"}` : "No saved preferences";
}

export default function OwnerRecurringOrdersScreen() {
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrderTemplate[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadRecurringOrders = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      setRecurringOrders(await getActiveRecurringOrders());
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load recurring orders.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecurringOrders();
  }, [loadRecurringOrders]);

  const sortedRecurringOrders = useMemo(
    () =>
      [...recurringOrders].sort((firstOrder, secondOrder) =>
        `${firstOrder.pickupWeekday} ${firstOrder.pickupWindow}`.localeCompare(
          `${secondOrder.pickupWeekday} ${secondOrder.pickupWindow}`,
        ),
      ),
    [recurringOrders],
  );

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Active recurring orders</Text>
          <Text style={styles.body}>
            Review customer templates for repeat laundry service. These are
            active schedules customers have saved for future repeat orders.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Active templates</Text>
          <Text style={styles.summaryValue}>{recurringOrders.length}</Text>
          <Text style={styles.summaryNote}>
            Use this view to plan repeat customer demand and follow up before
            turning templates into real orders.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && sortedRecurringOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active recurring orders yet</Text>
            <Text style={styles.muted}>
              When customers create active recurring order templates, they will
              appear here for the owner to review.
            </Text>
          </View>
        ) : null}

        <View style={styles.orderGrid}>
          {sortedRecurringOrders.map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View style={styles.orderTitleGroup}>
                  <Text style={styles.orderTitle}>{order.serviceName}</Text>
                  <Text style={styles.orderMeta}>
                    Customer: {order.customerName || order.customerId}
                  </Text>
                </View>
                <Text style={styles.statusPill}>Active</Text>
              </View>

              <View style={styles.scheduleBox}>
                <Text style={styles.scheduleLabel}>Schedule</Text>
                <Text style={styles.scheduleValue}>
                  {formatFrequency(order.frequency)} · {order.pickupWeekday} ·{" "}
                  {order.pickupWindow}
                </Text>
              </View>

              <Text style={styles.preferenceCount}>
                {formatPreferenceCount(order)}
              </Text>

              {order.selectedAddOns.length > 0 ? (
                <View style={styles.preferenceBox}>
                  <Text style={styles.preferenceTitle}>Laundry add-ons</Text>
                  <Text style={styles.preferenceText}>
                    {order.selectedAddOns
                      .map((addOn) => `${addOn.name} x${addOn.quantity ?? 1}`)
                      .join(", ")}
                  </Text>
                </View>
              ) : null}

              {order.selectedDryCleaningItems.length > 0 ? (
                <View style={styles.preferenceBox}>
                  <Text style={styles.preferenceTitle}>Dry cleaning</Text>
                  <Text style={styles.preferenceText}>
                    {order.selectedDryCleaningItems
                      .map((item) => `${item.name} x${item.quantity ?? 1}`)
                      .join(", ")}
                  </Text>
                </View>
              ) : null}

              {order.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.preferenceTitle}>Customer notes</Text>
                  <Text style={styles.preferenceText}>{order.notes}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  header: {
    gap: spacing.xs,
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
  summaryCard: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 40,
  },
  summaryNote: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  orderGrid: {
    gap: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  orderHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  orderTitleGroup: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  orderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 8,
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  scheduleBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    padding: spacing.sm,
  },
  scheduleLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scheduleValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  preferenceCount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  preferenceBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  notesBox: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  preferenceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  preferenceText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
