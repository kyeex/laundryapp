import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { getAdminBatches } from "@/services/batchService";
import { resetLocalDemoData, seedLocalDemoOrders } from "@/services/demoControlService";
import { getAdminOrders } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, Order, UserRole } from "@/types/domain";

const roleJumpOptions: Array<{
  label: string;
  role: Extract<UserRole, "customer" | "owner" | "driver" | "admin">;
  note: string;
}> = [
  {
    label: "Customer",
    role: "customer",
    note: "Place a new order, review payment, and track status.",
  },
  {
    label: "Owner",
    role: "owner",
    note: "Accept requests, price orders, and create batches.",
  },
  {
    label: "Driver",
    role: "driver",
    note: "Open assigned batches and submit route stops.",
  },
  {
    label: "Admin",
    role: "admin",
    note: "Return to admin tools and demo controls.",
  },
];

function StatCard({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statNote}>{note}</Text>
    </View>
  );
}

export default function DemoControlCenterScreen() {
  const { currentUser, isConfigured, startDemoSession } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadDemoSummary = useCallback(async () => {
    if (currentUser?.role !== "admin") {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [loadedOrders, loadedBatches] = await Promise.all([
        getAdminOrders(),
        getAdminBatches(),
      ]);

      setOrders(loadedOrders);
      setBatches(loadedBatches);
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load demo summary right now.";
      setError(loadMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadDemoSummary();
  }, [loadDemoSummary]);

  const requestedOrders = useMemo(
    () => orders.filter((order) => order.status === "requested").length,
    [orders],
  );
  const pickupReadyOrders = useMemo(
    () =>
      orders.filter((order) => order.status === "accepted" && !order.pickupBatchId)
        .length,
    [orders],
  );
  const deliveryReadyOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          ["ready_for_delivery", "paid", "priced"].includes(order.status) &&
          !order.deliveryBatchId,
      ).length,
    [orders],
  );

  async function handleResetDemoData() {
    if (currentUser?.role !== "admin") {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      resetLocalDemoData();
      setMessage("Demo data reset to the baseline sample orders, batches, and users.");
      await loadDemoSummary();
    } catch (resetError) {
      const resetMessage =
        resetError instanceof Error
          ? resetError.message
          : "Unable to reset demo data right now.";
      setError(resetMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSeedFreshOrders() {
    if (currentUser?.role !== "admin") {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const createdCount = seedLocalDemoOrders();
      setMessage(
        `${createdCount} fresh sample orders seeded: one new request, one pickup-ready order, and one delivery-ready order.`,
      );
      await loadDemoSummary();
    } catch (seedError) {
      const seedMessage =
        seedError instanceof Error
          ? seedError.message
          : "Unable to seed sample orders right now.";
      setError(seedMessage);
    } finally {
      setIsSaving(false);
    }
  }

  if (currentUser?.role !== "admin") {
    return <Redirect href="/(admin)" />;
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Admin demo tools</Text>
          <Text style={styles.title}>Demo control center</Text>
          <Text style={styles.body}>
            Use this page before a presentation to reset the story, add fresh
            sample orders, and jump between roles without hunting through the app.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Firebase mode</Text>
            <Text style={styles.noticeText}>
              Reset and seed actions are disabled when Firebase is connected so
              demo controls do not touch real backend data.
            </Text>
          </View>
        ) : null}

        <View style={styles.statGrid}>
          <StatCard
            label="Orders"
            note="All visible demo orders."
            value={`${orders.length}`}
          />
          <StatCard
            label="New requests"
            note="Ready for owner accept or decline."
            value={`${requestedOrders}`}
          />
          <StatCard
            label="Pickup-ready"
            note="Accepted orders not yet batched."
            value={`${pickupReadyOrders}`}
          />
          <StatCard
            label="Delivery-ready"
            note="Priced, paid, or ready orders not yet assigned."
            value={`${deliveryReadyOrders}`}
          />
          <StatCard
            label="Batches"
            note="Pickup, delivery, and combined route batches."
            value={`${batches.length}`}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Demo data</Text>
          <Text style={styles.muted}>
            Reset returns the demo to the original baseline. Seed adds a clean
            set of presentation orders without removing the baseline examples.
          </Text>
          <View style={styles.actionGrid}>
            <AppButton
              disabled={isConfigured || isSaving}
              label={isSaving ? "Working..." : "Reset demo data"}
              onPress={handleResetDemoData}
              variant="secondary"
            />
            <AppButton
              disabled={isConfigured || isSaving}
              label={isSaving ? "Working..." : "Seed fresh sample orders"}
              onPress={handleSeedFreshOrders}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jump to role</Text>
          <Text style={styles.muted}>
            Role jumps switch the active demo session and open that role's home
            dashboard.
          </Text>
          <View style={styles.roleGrid}>
            {roleJumpOptions.map((option) => (
              <View key={option.role} style={styles.roleCard}>
                <Text style={styles.roleTitle}>{option.label}</Text>
                <Text style={styles.roleNote}>{option.note}</Text>
                <AppButton
                  disabled={isConfigured}
                  label={`Jump to ${option.label}`}
                  onPress={() => startDemoSession(option.role)}
                  variant={option.role === "admin" ? "secondary" : "primary"}
                />
              </View>
            ))}
          </View>
        </View>

        <DemoWalkthrough
          title="Presentation checklist"
          steps={[
            "Reset demo data for a predictable baseline.",
            "Seed fresh sample orders if you want extra owner/batch activity.",
            "Jump to Customer and submit or review an order.",
            "Jump to Owner to accept, process, price, and batch orders.",
            "Jump to Driver to check off stops and submit the route.",
            "Return to Admin to manage users and reset the demo for the next walkthrough.",
          ]}
        />
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
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
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
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 150,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  statNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleCard: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.sm,
    minWidth: 220,
    padding: spacing.md,
  },
  roleTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  roleNote: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  notice: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  noticeText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
});
