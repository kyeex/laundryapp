import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import {
  ActionGrid,
  ActionLink,
  ActionPanel,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageHeader,
} from "@/components/OperatingDashboard";
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
        <PageHeader
          eyebrow="Driver"
          title="Driver home"
          description="Assigned pickup and delivery batches will appear here."
        />
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!isLoading && !nextBatch ? (
          <EmptyState title="No route assigned yet">
            Driver work starts after the owner creates and assigns a batch. For
            the demo, switch to Owner, create a pickup or delivery batch, then
            return here to open the route and check off stops.
          </EmptyState>
        ) : null}
        <MetricGrid>
          <MetricCard
            label="Assigned route"
            note={nextBatch ? formatDisplayDate(nextBatch.scheduledDate) : "No route assigned yet."}
            tone={nextBatch ? "success" : "neutral"}
            value={nextBatch ? "Ready" : "None"}
          />
          <MetricCard
            label="Stops remaining"
            note="Stops not yet checked off."
            tone={remainingStops > 0 ? "attention" : "success"}
            value={`${remainingStops}`}
          />
          <MetricCard
            label="Completed stops"
            note="Stops selected for route submission."
            tone={completedStops > 0 ? "info" : "neutral"}
            value={`${completedStops}`}
          />
        </MetricGrid>
        <ActionPanel title="Route actions">
          {nextBatch ? (
            <ActionLink
              href={{
                pathname: "/(driver)/batches/[batchId]",
                params: { batchId: nextBatch.id },
              }}
              label="Open assigned route"
              primary
            />
          ) : null}
          <ActionGrid>
            <ActionLink href="/(driver)/batches" label="View batches" />
          </ActionGrid>
        </ActionPanel>
        <DemoWalkthrough
          title="Driver demo path"
          steps={[
            "Open the assigned batch for today.",
            "Check off completed pickup or delivery stops.",
            "Finalize and submit the route for owner review.",
          ]}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
