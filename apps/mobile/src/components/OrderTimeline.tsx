import { Platform, StyleSheet, Text, View } from "react-native";

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
  index,
  isLast,
  state,
  title,
}: {
  description: string;
  index: number;
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
            {state === "complete" ? "✓" : state === "issue" ? "!" : index + 1}
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
        <View style={styles.stepTitleRow}>
          <Text style={[styles.stepTitle, state === "active" && styles.stepTitleActive]}>
            {title}
          </Text>
          {state === "active" ? <Text style={styles.activePill}>Now</Text> : null}
          {state === "complete" ? <Text style={styles.completePill}>Done</Text> : null}
        </View>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

function HorizontalTimelineStep({
  description,
  index,
  isLast,
  state,
  title,
}: {
  description: string;
  index: number;
  isLast: boolean;
  state: StepState;
  title: string;
}) {
  return (
    <View style={styles.horizontalStep}>
      <View style={styles.horizontalVisual}>
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
            {state === "complete" ? "✓" : state === "issue" ? "!" : index + 1}
          </Text>
        </View>
        {!isLast ? (
          <View
            style={[
              styles.horizontalLine,
              state === "complete" && styles.stepLineComplete,
            ]}
          />
        ) : null}
      </View>
      <Text style={[styles.stepTitle, state === "active" && styles.stepTitleActive]}>
        {title}
      </Text>
      <Text style={styles.stepDescription}>{description}</Text>
    </View>
  );
}

export function OrderTimeline({
  orientation = "vertical",
  status,
}: {
  orientation?: "vertical" | "horizontal";
  status: OrderStatus;
}) {
  const activeIndex = getOrderTimelineStepIndex(status);
  const steps = orderTimelineSteps.map((step, index) => ({
    ...step,
    isLast: index === orderTimelineSteps.length - 1,
    stepNumber: index,
    state: getOrderStepState(index, activeIndex, status),
  }));
  const activeStep = steps[activeIndex] ?? steps[0];

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Order timeline</Text>
          <Text style={styles.cardSubtitle}>
            {isStoppedOrderStatus(status)
              ? "This order needs attention."
              : activeStep
                ? `Current step: ${activeStep.title}`
                : "Tracking is being prepared."}
          </Text>
        </View>
        <Text
          style={[
            styles.timelineBadge,
            isStoppedOrderStatus(status) && styles.timelineBadgeIssue,
          ]}
        >
          {isStoppedOrderStatus(status) ? "Issue" : "Live"}
        </Text>
      </View>
      {orientation === "horizontal" ? (
        <View style={styles.horizontalTrack}>
          {steps.map((step) => (
            <HorizontalTimelineStep
              description={step.description}
              index={step.stepNumber}
              isLast={step.isLast}
              key={step.id}
              state={step.state}
              title={step.title}
            />
          ))}
        </View>
      ) : (
        steps.map((step) => (
          <TimelineRow
            description={step.description}
            index={step.stepNumber}
            isLast={step.isLast}
            key={step.id}
            state={step.state}
            title={step.title}
          />
        ))
      )}
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
          index={index}
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
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  cardTitle: {
    color: colors.text,
    fontSize: Platform.select({
      default: 17,
      web: 18,
    }),
    fontWeight: "800",
  },
  cardSubtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  timelineBadge: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  timelineBadgeIssue: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    color: colors.danger,
  },
  timelineRow: {
    flexDirection: "row",
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    minHeight: Platform.select({
      default: 78,
      web: 72,
    }),
  },
  timelineVisual: {
    alignItems: "center",
    width: Platform.select({
      default: 36,
      web: 32,
    }),
  },
  stepDot: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    height: Platform.select({
      default: 36,
      web: 32,
    }),
    justifyContent: "center",
    width: Platform.select({
      default: 36,
      web: 32,
    }),
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
    fontSize: 12,
    fontWeight: "900",
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
  stepTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  stepTitle: {
    color: colors.text,
    fontSize: Platform.select({
      default: 15,
      web: 16,
    }),
    fontWeight: "800",
  },
  stepTitleActive: {
    color: colors.primary,
  },
  stepDescription: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 13,
      web: 14,
    }),
    lineHeight: Platform.select({
      default: 19,
      web: 20,
    }),
  },
  activePill: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  completePill: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  horizontalTrack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  horizontalStep: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: Platform.select({
      default: "47%",
      web: 150,
    }),
    padding: spacing.sm,
  },
  horizontalVisual: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  horizontalLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 2,
  },
});
