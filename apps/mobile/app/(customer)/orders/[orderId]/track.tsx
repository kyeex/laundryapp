import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

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
              <Text style={styles.cardTitle}>Delivery details</Text>
              <Text style={styles.value}>{formatAddress(order.addressSnapshot)}</Text>
              <Text style={styles.muted}>
                Pickup: {formatDisplayDate(order.scheduledPickupDate)} · {order.scheduledPickupWindow}
              </Text>
              <Text style={styles.muted}>
                Drop-off: {formatDisplayDate(order.scheduledDropoffDate)} ·{" "}
                {order.scheduledDropoffWindow}
              </Text>
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
    gap: spacing.md,
    paddingTop: spacing.lg,
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
    fontSize: 32,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
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
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
