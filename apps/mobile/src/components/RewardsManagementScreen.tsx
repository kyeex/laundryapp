import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { getManagedUsers } from "@/services/adminUserService";
import { recordAuditLog } from "@/services/auditLogService";
import { getBusinessSettings, saveBusinessSettings } from "@/services/configurationService";
import {
  adjustCustomerRewards,
  getCustomerLoyaltyRewards,
  getCustomerRewardEvents,
  getLoyaltyRewardsDirectory,
  type LoyaltyRewardEvent,
  type LoyaltyRewardsAccount,
} from "@/services/loyaltyRewardsService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AppUser, BusinessSettings } from "@/types/domain";
import { formatDisplayDateTime } from "@/utils/dateFormat";

import { AppButton } from "./AppButton";
import { FormTextInput } from "./FormTextInput";
import { EmptyState, PageHeader } from "./OperatingDashboard";
import { Screen } from "./Screen";

type RewardsManagementScreenProps = {
  includeManagedUsers?: boolean;
  showProgramToggle?: boolean;
  subtitle: string;
  title: string;
};

function formatPoints(points: number) {
  return points > 0 ? `+${points}` : `${points}`;
}

export function RewardsManagementScreen({
  includeManagedUsers = false,
  showProgramToggle = false,
  subtitle,
  title,
}: RewardsManagementScreenProps) {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState<LoyaltyRewardsAccount[]>([]);
  const [adjustmentPoints, setAdjustmentPoints] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [events, setEvents] = useState<LoyaltyRewardEvent[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProgram, setIsSavingProgram] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [managedUsers, setManagedUsers] = useState<AppUser[]>([]);
  const [programSettings, setProgramSettings] = useState<BusinessSettings | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [success, setSuccess] = useState("");

  const loadRewards = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [rewardAccounts, users, settings] = await Promise.all([
        getLoyaltyRewardsDirectory(),
        includeManagedUsers
          ? getManagedUsers().catch(() => [] as AppUser[])
          : Promise.resolve([] as AppUser[]),
        showProgramToggle ? getBusinessSettings() : Promise.resolve(null),
      ]);

      setAccounts(rewardAccounts);
      setManagedUsers(users.filter((user) => user.role === "customer"));
      setProgramSettings(settings);
      setSelectedCustomerId((current) => current || rewardAccounts[0]?.customerId || "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load rewards management.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [includeManagedUsers, showProgramToggle]);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  const customerRows = useMemo(() => {
    const accountRows = accounts.map((account) => ({
      customerId: account.customerId,
      customerName: account.customerName,
      email: "",
      pointsBalance: account.pointsBalance,
      source: "Rewards account",
    }));
    const accountIds = new Set(accountRows.map((account) => account.customerId));
    const userRows = managedUsers
      .filter((user) => !accountIds.has(user.id))
      .map((user) => ({
        customerId: user.id,
        customerName: user.displayName || user.email,
        email: user.email,
        pointsBalance: 0,
        source: "Signed-up customer",
      }));
    const normalizedSearch = search.trim().toLowerCase();

    return [...accountRows, ...userRows]
      .filter((row) =>
        normalizedSearch
          ? `${row.customerName} ${row.email}`.toLowerCase().includes(normalizedSearch)
          : true,
      )
      .sort((firstRow, secondRow) =>
        firstRow.customerName.localeCompare(secondRow.customerName),
      );
  }, [accounts, managedUsers, search]);

  const selectedCustomer = customerRows.find(
    (customer) => customer.customerId === selectedCustomerId,
  );
  const selectedAccount = accounts.find(
    (account) => account.customerId === selectedCustomerId,
  );

  const loadEvents = useCallback(async () => {
    if (!selectedCustomerId) {
      setEvents([]);
      return;
    }

    try {
      setEvents(await getCustomerRewardEvents(selectedCustomerId, 100));
    } catch {
      setEvents([]);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function handleAdjustRewards() {
    if (!currentUser || !selectedCustomer) {
      return;
    }

    const points = Number.parseInt(adjustmentPoints, 10);

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const account = await adjustCustomerRewards({
        actor: currentUser,
        customerId: selectedCustomer.customerId,
        customerName: selectedCustomer.customerName,
        points,
        reason: adjustmentReason,
      });

      setAccounts((current) =>
        current.some((item) => item.customerId === account.customerId)
          ? current.map((item) =>
              item.customerId === account.customerId ? account : item,
            )
          : [...current, account],
      );
      setAdjustmentPoints("");
      setAdjustmentReason("");
      setSuccess("Rewards adjustment saved and audit logged.");
      await loadEvents();
    } catch (adjustError) {
      setError(
        adjustError instanceof Error
          ? adjustError.message
          : "Unable to adjust rewards.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleProgram() {
    if (!programSettings) {
      return;
    }

    const nextEnabled = !programSettings.loyaltyRewards.enabled;
    const nextSettings: BusinessSettings = {
      ...programSettings,
      loyaltyRewards: {
        ...programSettings.loyaltyRewards,
        enabled: nextEnabled,
      },
    };

    setError("");
    setSuccess("");
    setIsSavingProgram(true);

    try {
      await saveBusinessSettings(nextSettings);

      if (currentUser) {
        await recordAuditLog({
          actorId: currentUser.id,
          actorRole: currentUser.role,
          action: nextEnabled ? "rewards.enabled" : "rewards.disabled",
          resourceType: "configuration",
          resourceId: "business",
          summary: nextEnabled
            ? "Enabled customer rewards from rewards management."
            : "Disabled customer rewards from rewards management.",
          metadata: {
            rewardsEnabled: nextEnabled,
          },
        });
      }

      setProgramSettings(nextSettings);
      setSuccess(
        nextEnabled
          ? "Customer rewards are now enabled."
          : "Customer rewards are now disabled.",
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update rewards setting.",
      );
    } finally {
      setIsSavingProgram(false);
    }
  }

  const rewardsEnabled = programSettings?.loyaltyRewards.enabled ?? false;

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <PageHeader
            eyebrow="Rewards operations"
            title={title}
            description={subtitle}
          />
        </View>

        {showProgramToggle ? (
          <View
            style={[
              styles.programPanel,
              rewardsEnabled ? styles.programPanelEnabled : styles.programPanelDisabled,
            ]}
          >
            <View style={styles.programCopy}>
              <Text style={styles.programEyebrow}>Rewards availability</Text>
              <Text style={styles.programTitle}>
                {rewardsEnabled ? "Rewards are live" : "Rewards are paused"}
              </Text>
              <Text style={styles.programText}>
                {rewardsEnabled
                  ? "Customers can see rewards, earn points, view their ledger, and apply available credits at checkout."
                  : "Rewards are hidden from customer home and checkout. Existing point balances remain saved for later."}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{
                checked: rewardsEnabled,
                disabled: !programSettings || isSavingProgram,
              }}
              disabled={!programSettings || isSavingProgram}
              onPress={handleToggleProgram}
              style={[
                styles.programSwitch,
                rewardsEnabled && styles.programSwitchEnabled,
                (!programSettings || isSavingProgram) && styles.programSwitchDisabled,
              ]}
            >
              {rewardsEnabled ? null : <View style={styles.programSwitchThumb} />}
              <Text
                style={[
                  styles.programSwitchText,
                  rewardsEnabled && styles.programSwitchTextEnabled,
                ]}
              >
                {isSavingProgram ? "Saving" : rewardsEnabled ? "On" : "Off"}
              </Text>
              {rewardsEnabled ? <View style={styles.programSwitchThumb} /> : null}
            </Pressable>
          </View>
        ) : null}

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.layout}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Customers</Text>
            <FormTextInput
              label="Search customers"
              onChangeText={setSearch}
              placeholder="Name or email"
              value={search}
            />
            {customerRows.length === 0 ? (
              <EmptyState title="No reward customers yet">
                  Reward accounts appear after customers earn points or after an
                  owner/admin creates an adjustment.
              </EmptyState>
            ) : null}
            {customerRows.map((customer) => {
              const selected = customer.customerId === selectedCustomerId;

              return (
                <Pressable
                  key={customer.customerId}
                  onPress={() => setSelectedCustomerId(customer.customerId)}
                  style={[styles.customerButton, selected && styles.customerButtonActive]}
                >
                  <View style={styles.customerCopy}>
                    <Text
                      style={[
                        styles.customerName,
                        selected && styles.customerNameActive,
                      ]}
                    >
                      {customer.customerName}
                    </Text>
                    <Text
                      style={[styles.customerMeta, selected && styles.customerMetaActive]}
                    >
                      {customer.source}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.customerPoints,
                      selected && styles.customerPointsActive,
                    ]}
                  >
                    {customer.pointsBalance}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Reward account</Text>
            {selectedCustomer ? (
              <>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Selected customer</Text>
                  <Text style={styles.summaryValue}>{selectedCustomer.customerName}</Text>
                  <Text style={styles.muted}>
                    Current balance: {selectedAccount?.pointsBalance ?? 0} points ·
                    Lifetime: {selectedAccount?.lifetimePoints ?? 0} · Redeemed:{" "}
                    {selectedAccount?.redeemedPoints ?? 0}
                  </Text>
                </View>

                <View style={styles.adjustBox}>
                  <Text style={styles.cardTitle}>Manual adjustment</Text>
                  <Text style={styles.muted}>
                    Use positive numbers to add points and negative numbers to remove
                    points. A reason is required and the action is audit logged.
                  </Text>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Points"
                    onChangeText={setAdjustmentPoints}
                    placeholder="Example: 25 or -10"
                    value={adjustmentPoints}
                  />
                  <FormTextInput
                    label="Reason"
                    onChangeText={setAdjustmentReason}
                    placeholder="Courtesy credit, correction, issue resolution..."
                    value={adjustmentReason}
                  />
                  <AppButton
                    disabled={isSaving || !adjustmentPoints || !adjustmentReason}
                    label={isSaving ? "Saving..." : "Save rewards adjustment"}
                    onPress={handleAdjustRewards}
                  />
                </View>

                <View style={styles.ledgerBox}>
                  <Text style={styles.cardTitle}>Rewards ledger</Text>
                  {events.length === 0 ? (
                    <Text style={styles.muted}>No ledger entries yet.</Text>
                  ) : null}
                  {events.map((event) => (
                    <View key={event.id} style={styles.eventRow}>
                      <View style={styles.eventCopy}>
                        <Text style={styles.eventTitle}>{event.label}</Text>
                        <Text style={styles.muted}>
                          {event.createdAt
                            ? formatDisplayDateTime(event.createdAt)
                            : "Timestamp pending"}
                          {event.reason ? ` · ${event.reason}` : ""}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.eventPoints,
                          event.points < 0 && styles.eventPointsNegative,
                        ]}
                      >
                        {formatPoints(event.points)}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <EmptyState title="Select a customer">
                  Choose a customer to view their points, ledger, and adjustment
                  controls.
              </EmptyState>
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  programPanel: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  programPanelEnabled: {
    backgroundColor: "#ECFDF5",
    borderColor: "#34D399",
  },
  programPanelDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
  },
  programCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 250,
  },
  programEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  programTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  programText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  programSwitch: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    minWidth: 124,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  programSwitchEnabled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  programSwitchDisabled: {
    opacity: 0.6,
  },
  programSwitchThumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 30,
    width: 30,
  },
  programSwitchText: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  programSwitchTextEnabled: {
    color: colors.onPrimary,
  },
  layout: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minWidth: 320,
    padding: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  customerButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  customerButtonActive: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  customerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  customerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  customerNameActive: {
    color: colors.primary,
  },
  customerMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  customerMetaActive: {
    color: colors.text,
  },
  customerPoints: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  customerPointsActive: {
    color: colors.primary,
  },
  summaryCard: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
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
    fontSize: 24,
    fontWeight: "900",
  },
  adjustBox: {
    gap: spacing.sm,
  },
  ledgerBox: {
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  eventRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  eventCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  eventPoints: {
    color: colors.success,
    fontSize: 17,
    fontWeight: "900",
  },
  eventPointsNegative: {
    color: colors.danger,
  },
  emptyBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
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
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
  },
});
