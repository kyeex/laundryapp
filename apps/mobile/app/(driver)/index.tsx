import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getBatchOrders, getDriverBatches } from "@/services/batchService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";

function isPickupStop(batch: Batch, order: Order) {
  if (batch.type === "pickup") {
    return true;
  }

  if (batch.type === "delivery") {
    return false;
  }

  return order.pickupBatchId === batch.id || order.status === "pickup_assigned";
}

function isStopCompleted(batch: Batch, order: Order) {
  return order.status === (isPickupStop(batch, order) ? "picked_up" : "delivered");
}

function DashboardCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View style={styles.dashboardCard}>
      <Text style={styles.dashboardLabel}>{label}</Text>
      <Text style={styles.dashboardValue}>{value}</Text>
      <Text style={styles.dashboardNote}>{note}</Text>
    </View>
  );
}

export default function DriverHomeScreen() {
  const { currentUser } = useAuth();
  const [nextBatch, setNextBatch] = useState<Batch | null>(null);
  const [routeOrders, setRouteOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const batches = await getDriverBatches(currentUser.id);
      const activeBatch =
        batches.find((batch) => batch.status === "assigned") ??
        batches.find((batch) => batch.status === "in_progress") ??
        batches[0] ??
        null;

      setNextBatch(activeBatch);
      setRouteOrders(activeBatch ? await getBatchOrders(activeBatch) : []);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load driver dashboard.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const completedStops = useMemo(
    () => (nextBatch ? routeOrders.filter((order) => isStopCompleted(nextBatch, order)).length : 0),
    [nextBatch, routeOrders],
  );
  const remainingStops = Math.max(0, routeOrders.length - completedStops);

  return (
    <Screen>
      <View style={styles.content}>
        <AccountPanel />
        <Text style={styles.title}>Driver home</Text>
        <Text style={styles.body}>
          Assigned pickup and delivery batches will appear here.
        </Text>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!isLoading && !nextBatch ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No route assigned yet</Text>
            <Text style={styles.emptyText}>
              Driver work starts after the owner creates and assigns a batch. For
              the demo, switch to Owner, create a pickup or delivery batch, then
              return here to open the route and check off stops.
            </Text>
          </View>
        ) : null}
        <View style={styles.dashboardGrid}>
          <DashboardCard
            label="Assigned route"
            note={nextBatch ? formatDisplayDate(nextBatch.scheduledDate) : "No route assigned yet."}
            value={nextBatch ? "Ready" : "None"}
          />
          <DashboardCard
            label="Stops remaining"
            note="Stops not yet checked off."
            value={`${remainingStops}`}
          />
          <DashboardCard
            label="Completed stops"
            note="Stops selected for route submission."
            value={`${completedStops}`}
          />
        </View>
        {nextBatch ? (
          <Link
            href={{
              pathname: "/(driver)/batches/[batchId]",
              params: { batchId: nextBatch.id },
            }}
            style={styles.action}
          >
            Open assigned route
          </Link>
        ) : null}
        <DemoWalkthrough
          title="Driver demo path"
          steps={[
            "Open the assigned batch for today.",
            "Check off completed pickup or delivery stops.",
            "Finalize and submit the route for owner review.",
          ]}
        />
        <Link href="/(driver)/batches" style={styles.link}>
          View batches
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
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
  link: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  action: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "800",
    padding: spacing.md,
    textAlign: "center",
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dashboardCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 160,
    padding: spacing.md,
  },
  dashboardLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dashboardValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  dashboardNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
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
});
