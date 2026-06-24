import { Link } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getDriverBatches } from "@/services/batchService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, BatchType } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import { formatOrderStatus } from "@/workflows/orderWorkflow";

function formatBatchType(type: BatchType) {
  if (type === "pickup_delivery") {
    return "Pick Up + Delivery";
  }

  return type === "pickup" ? "Pickup" : "Delivery";
}

export default function DriverBatchesScreen() {
  const { currentUser } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadBatches = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const driverBatches = await getDriverBatches(currentUser.id);
      setBatches(driverBatches);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load assigned batches right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Assigned batches</Text>
          <Text style={styles.body}>
            Pickup and delivery work assigned by the owner.
          </Text>
          <AppButton label="Refresh" onPress={loadBatches} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && batches.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No assigned batches</Text>
            <Text style={styles.muted}>
              Driver work appears here after the owner creates and assigns a
              pickup or delivery batch. For the demo, switch to Owner, create a
              batch, then return as Driver to run the route and submit completed
              stops.
            </Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {batches.map((batch) => (
            <Link
              href={{
                pathname: "/(driver)/batches/[batchId]",
                params: { batchId: batch.id },
              }}
              key={batch.id}
              style={styles.card}
            >
              <Text style={styles.kicker}>{formatBatchType(batch.type)}</Text>
              <Text style={styles.cardTitle}>{formatOrderStatus(batch.status)}</Text>
              <Text style={styles.muted}>
                {formatDisplayDate(batch.scheduledDate)} · {batch.orderIds.length} stop
                {batch.orderIds.length === 1 ? "" : "s"}
              </Text>
              {batch.notes ? <Text style={styles.muted}>{batch.notes}</Text> : null}
            </Link>
          ))}
        </View>
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  muted: {
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
