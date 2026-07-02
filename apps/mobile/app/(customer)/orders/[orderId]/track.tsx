import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { OrderTimeline } from "@/components/OrderTimeline";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { formatAddress, getCustomerOrderById } from "@/services/orderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import {
  formatOrderStatus,
  isStoppedOrderStatus,
} from "@/workflows/orderWorkflow";

export default function CustomerOrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { currentUser } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadOrder = useCallback(async () => {
    if (!currentUser || !orderId) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const customerOrder = await getCustomerOrderById(currentUser.id, orderId);
      setOrder(customerOrder);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tracking right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  return (
    <Screen>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isLoading && !order ? (
          <View style={styles.card}>
            <Text style={styles.title}>Tracking unavailable</Text>
            <Text style={styles.muted}>
              This order may not exist, or it may not belong to this account.
              Return to My orders and open an order from the current account to
              view tracking.
            </Text>
          </View>
        ) : null}

        {order ? (
          <>
            <View style={styles.header}>
              <Text style={styles.kicker}>Order tracking</Text>
              <Text style={styles.title}>{formatOrderStatus(order.status)}</Text>
              <Text style={styles.muted}>
                Pickup {formatDisplayDate(order.scheduledPickupDate)} · Drop-off{" "}
                {formatDisplayDate(order.scheduledDropoffDate)}
              </Text>
            </View>

            {!isStoppedOrderStatus(order.status) ? (
              <View style={styles.reassuranceCard}>
                <View style={styles.reassuranceIcon}>
                  <Text style={styles.reassuranceIconText}>OK</Text>
                </View>
                <View style={styles.reassuranceCopy}>
                  <Text style={styles.reassuranceTitle}>Your order is moving</Text>
                  <Text style={styles.reassuranceText}>
                    We will keep this timeline updated as pickup, cleaning, payment,
                    delivery, and completion steps happen.
                  </Text>
                </View>
              </View>
            ) : null}

            {isStoppedOrderStatus(order.status) ? (
              <View style={styles.issueCard}>
                <Text style={styles.issueTitle}>Attention needed</Text>
                <Text style={styles.issueText}>
                  This order is currently marked {formatOrderStatus(order.status)}.
                </Text>
              </View>
            ) : null}

            <OrderTimeline status={order.status} />

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order details</Text>
              <Text style={styles.value}>{formatAddress(order.addressSnapshot)}</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>Pickup</Text>
                  <Text style={styles.detailValue}>
                    {formatDisplayDate(order.scheduledPickupDate)}
                  </Text>
                  <Text style={styles.detailMeta}>{order.scheduledPickupWindow}</Text>
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailLabel}>Drop-off</Text>
                  <Text style={styles.detailValue}>
                    {formatDisplayDate(order.scheduledDropoffDate)}
                  </Text>
                  <Text style={styles.detailMeta}>{order.scheduledDropoffWindow}</Text>
                </View>
              </View>
            </View>

            <AppButton label="Refresh tracking" onPress={loadOrder} variant="secondary" />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    paddingBottom: spacing.xl,
    paddingTop: Platform.select({
      default: spacing.sm,
      web: spacing.lg,
    }),
  },
  header: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: Platform.select({
      default: 30,
      web: 32,
    }),
    fontWeight: "800",
    lineHeight: Platform.select({
      default: 36,
      web: undefined,
    }),
    textTransform: "capitalize",
  },
  muted: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    lineHeight: Platform.select({
      default: 20,
      web: 22,
    }),
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 82,
  },
  timelineVisual: {
    alignItems: "center",
    width: 36,
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  stepDotComplete: {
    backgroundColor: "#D1FAE5",
    borderColor: colors.success,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotIssue: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  stepDotText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  stepDotTextActive: {
    color: colors.onPrimary,
  },
  stepLine: {
    backgroundColor: colors.border,
    flex: 1,
    width: 2,
  },
  stepLineComplete: {
    backgroundColor: colors.success,
  },
  stepContent: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  stepTitleActive: {
    color: colors.primary,
  },
  issueCard: {
    backgroundColor: "#FEF2F2",
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  issueTitle: {
    color: colors.danger,
    fontSize: 17,
    fontWeight: "800",
  },
  issueText: {
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
  },
  value: {
    color: colors.text,
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    lineHeight: Platform.select({
      default: 20,
      web: 22,
    }),
  },
  reassuranceCard: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  reassuranceIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  reassuranceIconText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  reassuranceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  reassuranceTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  reassuranceText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailTile: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: Platform.select({
      default: "100%",
      web: 160,
    }),
    padding: spacing.sm,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  detailMeta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
