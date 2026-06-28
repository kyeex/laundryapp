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
import type { AppUser, BusinessSettings, LoyaltyRewardTier } from "@/types/domain";
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

const tierColorOptions = [
  { label: "Mint", value: "#ECFDF5" },
  { label: "Sky", value: "#EFF6FF" },
  { label: "Gold", value: "#FEF3C7" },
  { label: "Rose", value: "#FFE4E6" },
  { label: "Lavender", value: "#F3E8FF" },
  { label: "Slate", value: "#F1F5F9" },
  { label: "Peach", value: "#FFEDD5" },
  { label: "Aqua", value: "#CCFBF1" },
];

function formatPoints(points: number) {
  return points > 0 ? `+${points}` : `${points}`;
}

function parseTierPoints(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function createRewardsTier(sortOrder: number): LoyaltyRewardTier {
  return {
    id: `tier-${Date.now()}`,
    name: "New tier",
    description: "Describe what this tier means for customers.",
    minimumPoints: 0,
    color: "#F8FAFC",
    active: true,
    sortOrder,
  };
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
  const [openColorTierId, setOpenColorTierId] = useState<string | null>(null);

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

  function updateProgramTier(
    tierId: string,
    updater: (tier: LoyaltyRewardTier) => LoyaltyRewardTier,
  ) {
    setProgramSettings((currentSettings) => {
      if (!currentSettings) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        loyaltyRewards: {
          ...currentSettings.loyaltyRewards,
          tiers: currentSettings.loyaltyRewards.tiers.map((tier) =>
            tier.id === tierId ? updater(tier) : tier,
          ),
        },
      };
    });
  }

  function handleAddTier() {
    setProgramSettings((currentSettings) => {
      if (!currentSettings) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        loyaltyRewards: {
          ...currentSettings.loyaltyRewards,
          tiers: [
            ...currentSettings.loyaltyRewards.tiers,
            createRewardsTier(currentSettings.loyaltyRewards.tiers.length + 1),
          ],
        },
      };
    });
  }

  function handleRemoveTier(tierId: string) {
    setProgramSettings((currentSettings) => {
      if (!currentSettings || currentSettings.loyaltyRewards.tiers.length <= 1) {
        return currentSettings;
      }

      return {
        ...currentSettings,
        loyaltyRewards: {
          ...currentSettings.loyaltyRewards,
          tiers: currentSettings.loyaltyRewards.tiers.filter(
            (tier) => tier.id !== tierId,
          ),
        },
      };
    });
  }

  async function handleSaveTierSettings() {
    if (!currentUser || !programSettings) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSavingProgram(true);

    const sortedTiers = [...programSettings.loyaltyRewards.tiers]
      .sort((firstTier, secondTier) => {
        if (firstTier.minimumPoints !== secondTier.minimumPoints) {
          return firstTier.minimumPoints - secondTier.minimumPoints;
        }

        return firstTier.sortOrder - secondTier.sortOrder;
      })
      .map((tier, index) => ({
        ...tier,
        name: tier.name.trim(),
        description: tier.description.trim(),
        color: tier.color.trim() || "#F8FAFC",
        sortOrder: index + 1,
      }));
    const nextSettings: BusinessSettings = {
      ...programSettings,
      loyaltyRewards: {
        ...programSettings.loyaltyRewards,
        tiers: sortedTiers,
      },
    };

    try {
      await saveBusinessSettings(nextSettings);
      await recordAuditLog({
        actorId: currentUser.id,
        actorRole: currentUser.role,
        action: "rewards.tiers_updated",
        resourceType: "configuration",
        resourceId: "business",
        summary: "Updated customer rewards tier configuration.",
        metadata: {
          tiers: sortedTiers.map((tier) => ({
            id: tier.id,
            name: tier.name,
            minimumPoints: tier.minimumPoints,
            active: tier.active,
          })),
        },
      });
      setProgramSettings(nextSettings);
      setSuccess("Rewards tiers saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save rewards tiers.",
      );
    } finally {
      setIsSavingProgram(false);
    }
  }

  const rewardsEnabled = programSettings?.loyaltyRewards.enabled ?? false;
  const rewardTiers = useMemo(
    () =>
      [...(programSettings?.loyaltyRewards.tiers ?? [])].sort((firstTier, secondTier) => {
        if (firstTier.minimumPoints !== secondTier.minimumPoints) {
          return firstTier.minimumPoints - secondTier.minimumPoints;
        }

        return firstTier.sortOrder - secondTier.sortOrder;
      }),
    [programSettings?.loyaltyRewards.tiers],
  );

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
          <View style={styles.programStack}>
            <View
              style={[
                styles.programPanel,
                rewardsEnabled
                  ? styles.programPanelEnabled
                  : styles.programPanelDisabled,
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

            <View style={styles.tierEditorPanel}>
              <View style={styles.tierEditorHeader}>
                <View style={styles.programCopy}>
                  <Text style={styles.programEyebrow}>Tier levels</Text>
                  <Text style={styles.programTitle}>Customer rewards tiers</Text>
                  <Text style={styles.programText}>
                    These names, descriptions, colors, and point requirements are
                    shown on the customer rewards page.
                  </Text>
                </View>
                <View style={styles.tierEditorActions}>
                  <AppButton
                    label="Add tier"
                    onPress={handleAddTier}
                    variant="secondary"
                  />
                  <AppButton
                    disabled={!programSettings || isSavingProgram}
                    label={isSavingProgram ? "Saving..." : "Save tiers"}
                    onPress={handleSaveTierSettings}
                  />
                </View>
              </View>

              <View style={styles.tierList}>
                {rewardTiers.map((tier) => (
                  <View key={tier.id} style={styles.tierEditorCard}>
                    <View
                      style={[
                        styles.tierPreview,
                        { backgroundColor: tier.color, borderColor: tier.color },
                      ]}
                    >
                      <Text style={styles.tierPreviewLabel}>Customer preview</Text>
                      <Text style={styles.tierPreviewName}>{tier.name}</Text>
                      <Text style={styles.tierPreviewText}>
                        {tier.minimumPoints} lifetime points
                      </Text>
                    </View>

                    <View style={styles.tierForm}>
                      <View style={styles.tierRow}>
                        <View style={styles.tierField}>
                          <FormTextInput
                            label="Tier name"
                            onChangeText={(value) =>
                              updateProgramTier(tier.id, (currentTier) => ({
                                ...currentTier,
                                name: value,
                              }))
                            }
                            value={tier.name}
                          />
                        </View>
                        <View style={styles.tierField}>
                          <FormTextInput
                            keyboardType="number-pad"
                            label="Required points"
                            onChangeText={(value) =>
                              updateProgramTier(tier.id, (currentTier) => ({
                                ...currentTier,
                                minimumPoints: parseTierPoints(
                                  value,
                                  currentTier.minimumPoints,
                                ),
                              }))
                            }
                            value={tier.minimumPoints.toString()}
                          />
                        </View>
                        <View style={styles.tierField}>
                          <Text style={styles.fieldLabel}>Tier color</Text>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              setOpenColorTierId((currentTierId) =>
                                currentTierId === tier.id ? null : tier.id,
                              )
                            }
                            style={styles.colorSelect}
                          >
                            <View
                              style={[
                                styles.colorSwatch,
                                { backgroundColor: tier.color },
                              ]}
                            />
                            <Text style={styles.colorSelectText}>
                              {tierColorOptions.find(
                                (option) => option.value === tier.color,
                              )?.label ?? tier.color}
                            </Text>
                            <Text style={styles.colorChevron}>
                              {openColorTierId === tier.id ? "-" : "+"}
                            </Text>
                          </Pressable>
                          {openColorTierId === tier.id ? (
                            <View style={styles.colorDropdown}>
                              {tierColorOptions.map((option) => {
                                const selected = tier.color === option.value;

                                return (
                                  <Pressable
                                    accessibilityRole="button"
                                    key={option.value}
                                    onPress={() => {
                                      updateProgramTier(tier.id, (currentTier) => ({
                                        ...currentTier,
                                        color: option.value,
                                      }));
                                      setOpenColorTierId(null);
                                    }}
                                    style={[
                                      styles.colorOption,
                                      selected && styles.colorOptionSelected,
                                    ]}
                                  >
                                    <View
                                      style={[
                                        styles.colorSwatch,
                                        { backgroundColor: option.value },
                                      ]}
                                    />
                                    <Text style={styles.colorOptionText}>
                                      {option.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <FormTextInput
                        label="Tier description"
                        multiline
                        onChangeText={(value) =>
                          updateProgramTier(tier.id, (currentTier) => ({
                            ...currentTier,
                            description: value,
                          }))
                        }
                        style={styles.tierDescriptionInput}
                        value={tier.description}
                      />
                      <View style={styles.tierButtonRow}>
                        <AppButton
                          label={tier.active ? "Tier active" : "Tier hidden"}
                          onPress={() =>
                            updateProgramTier(tier.id, (currentTier) => ({
                              ...currentTier,
                              active: !currentTier.active,
                            }))
                          }
                          variant={tier.active ? "primary" : "secondary"}
                        />
                        <AppButton
                          disabled={rewardTiers.length <= 1}
                          label="Remove tier"
                          onPress={() => handleRemoveTier(tier.id)}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
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
  programStack: {
    gap: spacing.md,
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
  tierEditorPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  tierEditorHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  tierEditorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tierList: {
    gap: spacing.md,
  },
  tierEditorCard: {
    alignItems: "stretch",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    padding: spacing.md,
  },
  tierPreview: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minWidth: 210,
    padding: spacing.md,
  },
  tierPreviewLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tierPreviewName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  tierPreviewText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  tierForm: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 280,
  },
  tierRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  tierField: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 150,
  },
  tierDescriptionInput: {
    minHeight: 76,
    paddingVertical: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  colorSelect: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  colorSwatch: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 24,
    width: 24,
  },
  colorSelectText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  colorChevron: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  colorDropdown: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.xs,
  },
  colorOption: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  colorOptionSelected: {
    backgroundColor: "#F0FDFA",
    borderColor: colors.primary,
  },
  colorOptionText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  tierButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
