import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  calculateRewardCredit,
  getCustomerLoyaltyRewards,
  getCustomerRewardEvents,
  getLoyaltyRewardSettings,
  getNextRewardsTier,
  getRewardsTier,
  previewRedeemRewardCredit,
  type LoyaltyRewardEvent,
  type LoyaltyRewardsAccount,
} from "@/services/loyaltyRewardsService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { LoyaltyRewardSettings } from "@/types/domain";

const rewardCreditOptions = [1, 2, 5];

function formatActivityPoints(points: number) {
  return points > 0 ? `+${points}` : `${points}`;
}

export default function CustomerRewardsScreen() {
  const { currentUser } = useAuth();
  const [account, setAccount] = useState<LoyaltyRewardsAccount | null>(null);
  const [events, setEvents] = useState<LoyaltyRewardEvent[]>([]);
  const [settings, setSettings] = useState<LoyaltyRewardSettings | null>(null);
  const [selectedCredit, setSelectedCredit] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadRewards = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [customerRewards, rewardEvents, rewardSettings] = await Promise.all([
        getCustomerLoyaltyRewards(
          currentUser.id,
          currentUser.displayName || currentUser.email || "Customer",
        ),
        getCustomerRewardEvents(currentUser.id, 75),
        getLoyaltyRewardSettings(),
      ]);

      setAccount(customerRewards);
      setEvents(rewardEvents);
      setSettings(rewardSettings);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load rewards.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadRewards();
  }, [loadRewards]);

  const currentTier = useMemo(
    () => getRewardsTier(account?.lifetimePoints ?? 0, settings ?? undefined),
    [account?.lifetimePoints, settings],
  );
  const nextTier = useMemo(
    () => getNextRewardsTier(account?.lifetimePoints ?? 0, settings ?? undefined),
    [account?.lifetimePoints, settings],
  );
  const pointsToNextTier = nextTier
    ? Math.max(0, nextTier.minimumPoints - (account?.lifetimePoints ?? 0))
    : 0;
  const availableCredit = calculateRewardCredit(
    account?.pointsBalance ?? 0,
    settings ?? undefined,
  );
  const canRedeemSelectedCredit =
    account !== null &&
    settings !== null &&
    account.pointsBalance >= selectedCredit * settings.pointsPerRewardDollar;

  async function handleRedeemPreview() {
    if (!account) {
      return;
    }

    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const nextAccount = await previewRedeemRewardCredit(account, selectedCredit);
      setAccount(nextAccount);
      setEvents(await getCustomerRewardEvents(account.customerId, 75));
      setMessage(`Previewed a $${selectedCredit.toFixed(2)} reward credit.`);
    } catch (redeemError) {
      const message =
        redeemError instanceof Error
          ? redeemError.message
          : "Unable to preview reward redemption.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Laundry rewards</Text>
          <Text style={styles.body}>
            Earn points as orders are completed and turn them into future laundry
            credits.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        {account && !isLoading ? (
          <>
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Available points</Text>
                <Text style={styles.pointsValue}>{account.pointsBalance}</Text>
                <Text style={styles.heroMeta}>
                  Worth up to ${availableCredit.toFixed(2)} in reward credit.
                </Text>
              </View>
              <View style={styles.tierCard}>
                <Text style={styles.tierLabel}>Current tier</Text>
                <Text style={styles.tierName}>{currentTier.name}</Text>
                <Text style={styles.tierDescription}>{currentTier.description}</Text>
              </View>
            </View>

            <View style={styles.progressCard}>
              <Text style={styles.cardTitle}>Tier progress</Text>
              {nextTier ? (
                <>
                  <Text style={styles.muted}>
                    {pointsToNextTier} more lifetime points until {nextTier.name}.
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(
                            100,
                            ((account.lifetimePoints - currentTier.minimumPoints) /
                              Math.max(
                                1,
                                nextTier.minimumPoints - currentTier.minimumPoints,
                              )) *
                              100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.muted}>
                  You are already in the highest rewards tier.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Redeem rewards</Text>
              <Text style={styles.muted}>
                Every {settings?.pointsPerRewardDollar ?? 100} points can become
                $1.00 in laundry credit. Real redemption is available on the order
                payment page after the owner saves a final price.
              </Text>
              <View style={styles.creditGrid}>
                {rewardCreditOptions.map((credit) => {
                  const selected = selectedCredit === credit;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={credit}
                      onPress={() => setSelectedCredit(credit)}
                      style={[
                        styles.creditOption,
                        selected && styles.creditOptionSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.creditValue,
                          selected && styles.creditValueSelected,
                        ]}
                      >
                        ${credit}
                      </Text>
                      <Text
                        style={[
                          styles.creditMeta,
                          selected && styles.creditMetaSelected,
                        ]}
                      >
                        {credit * (settings?.pointsPerRewardDollar ?? 100)} points
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <AppButton
                disabled={!canRedeemSelectedCredit || isSaving}
                label={isSaving ? "Saving..." : "Preview reward credit"}
                onPress={handleRedeemPreview}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>How customers earn</Text>
              <View style={styles.earnGrid}>
                <View style={styles.earnItem}>
                  <Text style={styles.earnValue}>1x</Text>
                  <Text style={styles.earnText}>
                    {settings?.pointsPerDollar ?? 1} point per $1 spent
                  </Text>
                </View>
                <View style={styles.earnItem}>
                  <Text style={styles.earnValue}>
                    {settings?.signupBonusPoints ?? 50}
                  </Text>
                  <Text style={styles.earnText}>Welcome bonus points</Text>
                </View>
                <View style={styles.earnItem}>
                  <Text style={styles.earnValue}>100</Text>
                  <Text style={styles.earnText}>Future referral bonus idea</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent activity</Text>
              {events.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No rewards activity yet</Text>
                  <Text style={styles.muted}>
                    Completed paid orders and reward redemptions will appear here.
                  </Text>
                </View>
              ) : null}
              {events.map((event) => (
                <View key={event.id} style={styles.activityRow}>
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityLabel}>{event.label}</Text>
                    <Text style={styles.muted}>
                      {event.createdAt
                        ? event.createdAt.toLocaleDateString("en-US")
                        : "Recent"}
                      {event.reason ? ` · ${event.reason}` : ""}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.activityPoints,
                      event.points < 0 && styles.activityPointsRedeemed,
                    ]}
                  >
                    {formatActivityPoints(event.points)}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  header: {
    gap: spacing.xs,
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
  heroCard: {
    alignItems: "stretch",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    padding: spacing.md,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pointsValue: {
    color: colors.text,
    fontSize: 48,
    fontWeight: "900",
    lineHeight: 52,
  },
  heroMeta: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  tierCard: {
    backgroundColor: colors.surface,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 210,
    padding: spacing.md,
  },
  tierLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tierName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  tierDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  progressCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  progressTrack: {
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    height: 12,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: "100%",
  },
  creditGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  creditOption: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 110,
    padding: spacing.md,
  },
  creditOptionSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  creditValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  creditValueSelected: {
    color: colors.primary,
  },
  creditMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  creditMetaSelected: {
    color: colors.text,
  },
  earnGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  earnItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 150,
    padding: spacing.md,
  },
  earnValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  earnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  activityRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  activityCopy: {
    flex: 1,
    gap: 2,
  },
  activityLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  activityPoints: {
    color: colors.success,
    fontSize: 16,
    fontWeight: "900",
  },
  activityPointsRedeemed: {
    color: colors.danger,
  },
  empty: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
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
