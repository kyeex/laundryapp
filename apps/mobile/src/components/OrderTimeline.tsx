import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { BatchStatus, OrderStatus } from "@/types/domain";
import {
  getOrderTimelineStepIndex,
  isStoppedOrderStatus,
  orderTimelineSteps,
} from "@/workflows/orderWorkflow";

type StepState = "complete" | "active" | "pending" | "issue";

function getOrderStepState(index: number, activeIndex: number, status: OrderStatus): StepState {
  if (isStoppedOrderStatus(status)) {
    return index === activeIndex ? "issue" : "pending";
  }

  if (index < activeIndex) {
    return "complete";
  }

  if (index === activeIndex) {
    return "active";
  }

  return "pending";
}

function TimelineRow({
  description,
  isLast,
  state,
  title,
}: {
  description: string;
  isLast: boolean;
  state: StepState;
  title: string;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineVisual}>
        <View
          style={[
            styles.stepDot,
            state === "complete" && styles.stepDotComplete,
            state === "active" && styles.stepDotActive,
            state === "issue" && styles.stepDotIssue,
          ]}
        >
          <Text
            style={[
              styles.stepDotText,
              state !== "pending" && styles.stepDotTextActive,
            ]}
          >
            {state === "complete" ? "✓" : state === "issue" ? "!" : ""}
          </Text>
        </View>
        {!isLast ? (
          <View
            style={[
              styles.stepLine,
              state === "complete" && styles.stepLineComplete,
            ]}
          />
        ) : null}
      </View>
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, state === "active" && styles.stepTitleActive]}>
          {title}
        </Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const activeIndex = getOrderTimelineStepIndex(status);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Order timeline</Text>
      {orderTimelineSteps.map((step, index) => (
        <TimelineRow
          description={step.description}
          isLast={index === orderTimelineSteps.length - 1}
          key={step.id}
          state={getOrderStepState(index, activeIndex, status)}
          title={step.title}
        />
      ))}
    </View>
  );
}

export function DriverRouteTimeline({
  batchStatus,
  completedStops,
  stopActionLabel,
  totalStops,
}: {
  batchStatus: BatchStatus;
  completedStops: number;
  stopActionLabel: string;
  totalStops: number;
}) {
  const submitted = batchStatus === "completed";
  const hasCompletedStops = completedStops > 0;
  const routeSteps = [
    {
      id: "assigned",
      title: "Assigned",
      description: "The owner assigned this route to the driver.",
      state: submitted || hasCompletedStops ? "complete" : "active",
    },
    {
      id: "stops",
      title: stopActionLabel,
      description: `${completedStops} of ${totalStops} stop${
        totalStops === 1 ? "" : "s"
      } checked off.`,
      state: submitted ? "complete" : hasCompletedStops ? "active" : "pending",
    },
    {
      id: "submitted",
      title: "Submitted",
      description: "The driver finalized and submitted the route.",
      state: submitted ? "active" : "pending",
    },
  ] satisfies Array<{
    id: string;
    title: string;
    description: string;
    state: StepState;
  }>;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Route timeline</Text>
      {routeSteps.map((step, index) => (
        <TimelineRow
          description={step.description}
          isLast={index === routeSteps.length - 1}
          key={step.id}
          state={step.state}
          title={step.title}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
  timelineRow: {
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 72,
  },
  timelineVisual: {
    alignItems: "center",
    width: 32,
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
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
  stepDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
