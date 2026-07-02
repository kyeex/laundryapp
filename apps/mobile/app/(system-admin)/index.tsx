import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AccountPanel } from "@/components/AccountPanel";
import { DemoWalkthrough } from "@/components/DemoWalkthrough";
import {
  ActionGrid,
  ActionLink,
  ActionPanel,
  MetricCard,
  MetricGrid,
  PageHeader,
} from "@/components/OperatingDashboard";
import { RoleHomeVisual } from "@/components/RoleHomeVisual";
import { Screen } from "@/components/Screen";
import { getManagedUsers } from "@/services/adminUserService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AppUser } from "@/types/domain";

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
        <PageHeader
          eyebrow="System administration"
          title="Admin panel"
          description="Manage platform-level users, access, account recovery, and permission planning outside the owner operations dashboard."
        />
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <RoleHomeVisual role="admin" />
        <MetricGrid>
          <MetricCard
            label="Signed-up users"
            note="Customer accounts visible to admin."
            tone="info"
            value={`${signedUpUsers}`}
          />
          <MetricCard
            label="Active users"
            note="Accounts currently allowed to use the system."
            tone="success"
            value={`${activeUsers}`}
          />
          <MetricCard
            label="Inactive users"
            note="Accounts blocked from normal use."
            tone={inactiveUsers > 0 ? "attention" : "neutral"}
            value={`${inactiveUsers}`}
          />
          <MetricCard
            label="Admin tools"
            note="Role changes, resets, activation, and permissions."
            tone="accent"
            value="Ready"
          />
        </MetricGrid>
        <DemoWalkthrough
          title="Admin demo path"
          steps={[
            "Review signed-up users and recently created accounts.",
            "Create provisioned demo users and confirm role changes.",
            "Review role permissions before production hardening.",
          ]}
        />
        <ActionPanel title="Admin tools">
          <ActionLink href="/(system-admin)/users" label="User management" primary />
          <ActionGrid>
            <ActionLink href="/(system-admin)/demo-control" label="Demo control center" />
            <ActionLink href="/(system-admin)/audit-logs" label="Audit logs" />
            <ActionLink href="/(system-admin)/rewards" label="Rewards management" />
            <ActionLink href="/(system-admin)/permissions" label="Permission settings" />
          </ActionGrid>
        </ActionPanel>
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
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
