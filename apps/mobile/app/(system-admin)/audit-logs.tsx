import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import {
  getAuditLogs,
  type AuditLog,
  type AuditResourceType,
} from "@/services/auditLogService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { UserRole } from "@/types/domain";
import { formatDisplayDateTime } from "@/utils/dateFormat";

const roleFilters: Array<"all" | UserRole> = [
  "all",
  "admin",
  "owner",
  "driver",
  "customer",
];

const resourceTypeFilters: Array<"all" | AuditResourceType> = [
  "all",
  "order",
  "batch",
  "catalog",
  "configuration",
  "user",
  "payment",
  "rewards",
];

function parseDateFilter(value: string, endOfDay = false) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const slashMatch = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const dashMatch = normalizedValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  const month = slashMatch
    ? Number(slashMatch[1])
    : dashMatch
      ? Number(dashMatch[2])
      : NaN;
  const day = slashMatch
    ? Number(slashMatch[2])
    : dashMatch
      ? Number(dashMatch[3])
      : NaN;
  const year = slashMatch
    ? Number(slashMatch[3])
    : dashMatch
      ? Number(dashMatch[1])
      : NaN;

  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
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
  const [resourceTypeFilter, setResourceTypeFilter] =
    useState<"all" | AuditResourceType>("all");
  const [search, setSearch] = useState("");
  const [actorSearch, setActorSearch] = useState("");
  const [actionSearch, setActionSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    const normalizedActorSearch = actorSearch.trim().toLowerCase();
    const normalizedActionSearch = actionSearch.trim().toLowerCase();
    const parsedDateFrom = parseDateFilter(dateFrom);
    const parsedDateTo = parseDateFilter(dateTo, true);

    return logs.filter((log) => {
      const matchesRole = roleFilter === "all" || log.actorRole === roleFilter;
      const matchesResourceType =
        resourceTypeFilter === "all" || log.resourceType === resourceTypeFilter;
      const matchesActor =
        !normalizedActorSearch ||
        [log.actorId, log.actorRole]
          .join(" ")
          .toLowerCase()
          .includes(normalizedActorSearch);
      const matchesAction =
        !normalizedActionSearch ||
        log.action.toLowerCase().includes(normalizedActionSearch);
      const matchesDateFrom =
        !parsedDateFrom ||
        (log.createdAt !== null && log.createdAt.getTime() >= parsedDateFrom.getTime());
      const matchesDateTo =
        !parsedDateTo ||
        (log.createdAt !== null && log.createdAt.getTime() <= parsedDateTo.getTime());
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

      return (
        matchesRole &&
        matchesResourceType &&
        matchesActor &&
        matchesAction &&
        matchesDateFrom &&
        matchesDateTo &&
        (!normalizedSearch || searchableText.includes(normalizedSearch))
      );
    });
  }, [
    actionSearch,
    actorSearch,
    dateFrom,
    dateTo,
    logs,
    resourceTypeFilter,
    roleFilter,
    search,
  ]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      actorSearch.trim() ||
      actionSearch.trim() ||
      dateFrom.trim() ||
      dateTo.trim() ||
      roleFilter !== "all" ||
      resourceTypeFilter !== "all",
  );

  function clearFilters() {
    setSearch("");
    setActorSearch("");
    setActionSearch("");
    setDateFrom("");
    setDateTo("");
    setRoleFilter("all");
    setResourceTypeFilter("all");
  }

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
          <View style={styles.filterHeader}>
            <View>
              <Text style={styles.filterTitle}>Filters</Text>
              <Text style={styles.filterHint}>
                Narrow logs by who acted, what changed, and when it happened.
              </Text>
            </View>
            {hasActiveFilters ? (
              <AppButton label="Clear" onPress={clearFilters} variant="secondary" />
            ) : null}
          </View>
          <FormTextInput
            label="Keyword"
            onChangeText={setSearch}
            placeholder="Action, actor, resource, or summary"
            value={search}
          />
          <View style={styles.filterGrid}>
            <View style={styles.filterField}>
              <FormTextInput
                autoCapitalize="none"
                label="Actor"
                onChangeText={setActorSearch}
                placeholder="Actor ID or role"
                value={actorSearch}
              />
            </View>
            <View style={styles.filterField}>
              <FormTextInput
                autoCapitalize="none"
                label="Action"
                onChangeText={setActionSearch}
                placeholder="order.status_changed"
                value={actionSearch}
              />
            </View>
            <View style={styles.dateField}>
              <FormTextInput
                keyboardType="numbers-and-punctuation"
                label="From"
                onChangeText={setDateFrom}
                placeholder="MM/DD/YYYY"
                value={dateFrom}
              />
            </View>
            <View style={styles.dateField}>
              <FormTextInput
                keyboardType="numbers-and-punctuation"
                label="To"
                onChangeText={setDateTo}
                placeholder="MM/DD/YYYY"
                value={dateTo}
              />
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Role</Text>
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
          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Resource type</Text>
            <View style={styles.roleFilterRow}>
              {resourceTypeFilters.map((resourceType) => {
                const selected = resourceType === resourceTypeFilter;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={resourceType}
                    onPress={() => setResourceTypeFilter(resourceType)}
                    style={[styles.roleChip, selected && styles.roleChipSelected]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        selected && styles.roleChipTextSelected,
                      ]}
                    >
                      {resourceType}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
              <Text style={styles.timestamp}>{formatDisplayDateTime(log.createdAt)}</Text>
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  filterHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  filterTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  filterHint: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  filterField: {
    flexBasis: 220,
    flexGrow: 1,
  },
  dateField: {
    flexBasis: 150,
    flexGrow: 1,
  },
  filterGroup: {
    gap: spacing.xs,
  },
  groupLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
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
