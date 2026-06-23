import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { getAuditLogs, type AuditLog } from "@/services/auditLogService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { UserRole } from "@/types/domain";

const roleFilters: Array<"all" | UserRole> = [
  "all",
  "admin",
  "owner",
  "driver",
  "customer",
];

function formatDate(value: Date | null) {
  if (!value) {
    return "Pending timestamp";
  }

  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMetadata(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return "No metadata";
  }

  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}

export default function AuditLogsScreen() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      setLogs(await getAuditLogs(150));
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load audit logs right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;
      const searchableText = [
        log.action,
        log.actorRole,
        log.resourceType,
        log.resourceId,
        log.summary,
        log.actorId,
        formatMetadata(log.metadata),
      ]
        .join(" ")
        .toLowerCase();

      return matchesRole && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [logs, roleFilter, search]);

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>System administration</Text>
          <Text style={styles.title}>Audit logs</Text>
          <Text style={styles.body}>
            Review owner, driver, admin, payment, batch, and order activity
            captured from Firebase.
          </Text>
          <AppButton label="Refresh logs" onPress={loadLogs} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.filters}>
          <FormTextInput
            label="Search logs"
            onChangeText={setSearch}
            placeholder="Action, actor, resource, or summary"
            value={search}
          />
          <View style={styles.roleFilterRow}>
            {roleFilters.map((role) => {
              const selected = role === roleFilter;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={role}
                  onPress={() => setRoleFilter(role)}
                  style={[styles.roleChip, selected && styles.roleChipSelected]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      selected && styles.roleChipTextSelected,
                    ]}
                  >
                    {role}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.resultCount}>
          Showing {filteredLogs.length} of {logs.length} log
          {logs.length === 1 ? "" : "s"}.
        </Text>

        {!isLoading && logs.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No audit logs yet</Text>
            <Text style={styles.emptyText}>
              Logs appear after owner, driver, admin, payment, batch, or catalog
              actions are performed in Firebase mode.
            </Text>
          </View>
        ) : null}

        {filteredLogs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.action}>{log.action}</Text>
              <Text style={styles.timestamp}>{formatDate(log.createdAt)}</Text>
            </View>
            <Text style={styles.summary}>{log.summary}</Text>
            <Text style={styles.meta}>
              {log.actorRole} · {log.resourceType} · {log.resourceId}
            </Text>
            <Text style={styles.metadata}>{formatMetadata(log.metadata)}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
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
  filters: {
    gap: spacing.sm,
  },
  roleFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  roleChipTextSelected: {
    color: colors.onPrimary,
  },
  resultCount: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  logCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  logHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  action: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 180,
  },
  timestamp: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  summary: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  metadata: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
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
    fontSize: 17,
    fontWeight: "800",
  },
  emptyText: {
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
