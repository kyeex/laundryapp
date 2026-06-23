import { Link } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import { Screen } from "@/components/Screen";
import { getManagedUsers } from "@/services/adminUserService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AppUser } from "@/types/domain";

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

export default function SystemAdminHomeScreen() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      setUsers(await getManagedUsers());
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load admin dashboard.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const activeUsers = useMemo(() => users.filter((user) => user.active).length, [users]);
  const inactiveUsers = Math.max(0, users.length - activeUsers);
  const signedUpUsers = users.filter((user) => user.role === "customer").length;

  return (
    <Screen>
      <View style={styles.content}>
        <AccountPanel />
        <Text style={styles.kicker}>System administration</Text>
        <Text style={styles.title}>Admin panel</Text>
        <Text style={styles.body}>
          Manage platform-level users, access, account recovery, and permission
          planning outside the owner operations dashboard.
        </Text>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.dashboardGrid}>
          <DashboardCard
            label="Signed-up users"
            note="Customer accounts visible to admin."
            value={`${signedUpUsers}`}
          />
          <DashboardCard
            label="Active users"
            note="Accounts currently allowed to use the system."
            value={`${activeUsers}`}
          />
          <DashboardCard
            label="Inactive users"
            note="Accounts blocked from normal use."
            value={`${inactiveUsers}`}
          />
          <DashboardCard
            label="Admin tools"
            note="Role changes, resets, activation, and permissions."
            value="Ready"
          />
        </View>
        <DemoWalkthrough
          title="Admin demo path"
          steps={[
            "Review signed-up users and recently created accounts.",
            "Create provisioned demo users and confirm role changes.",
            "Review role permissions before production hardening.",
          ]}
        />
        <View style={styles.grid}>
          <Link href="/(system-admin)/demo-control" style={styles.card}>
            Demo control center
          </Link>
          <Link href="/(system-admin)/audit-logs" style={styles.card}>
            Audit logs
          </Link>
          <Link href="/(system-admin)/users" style={styles.card}>
            User management
          </Link>
          <Link href="/(system-admin)/permissions" style={styles.card}>
            Permission settings
          </Link>
        </View>
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Production note</Text>
          <Text style={styles.noteText}>
            Creating privileged users should be handled by a secure backend
            function. The demo panel shows the workflow without exposing admin
            credentials inside the mobile app.
          </Text>
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
  grid: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 17,
    fontWeight: "800",
    padding: spacing.md,
  },
  note: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  noteText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
