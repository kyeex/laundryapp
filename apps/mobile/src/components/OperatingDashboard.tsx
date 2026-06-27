import { Link, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type Tone = "neutral" | "attention" | "info" | "success" | "accent";

const toneStyles = {
  neutral: {
    card: {},
    value: {},
    status: {},
  },
  attention: {
    card: { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
    value: { color: "#92400E" },
    status: { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#FFFFFF" },
  },
  info: {
    card: { backgroundColor: "#EFF6FF", borderColor: "#60A5FA" },
    value: { color: "#1D4ED8" },
    status: {},
  },
  success: {
    card: { backgroundColor: "#ECFDF5", borderColor: "#34D399" },
    value: { color: "#047857" },
    status: {},
  },
  accent: {
    card: { backgroundColor: "#F5F3FF", borderColor: "#A78BFA" },
    value: { color: "#6D28D9" },
    status: {},
  },
} satisfies Record<
  Tone,
  {
    card: object;
    value: object;
    status: object;
  }
>;

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.header}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <View style={styles.metricGrid}>{children}</View>;
}

export function MetricCard({
  href,
  label,
  note,
  status,
  tone = "neutral",
  value,
}: {
  href?: Href;
  label: string;
  note: string;
  status?: string;
  tone?: Tone;
  value: string;
}) {
  const content = (
    <View style={styles.metricContent}>
      <View style={styles.metricTextGroup}>
        <Text style={styles.metricLabel}>{label}</Text>
        {status ? (
          <Text style={[styles.metricStatus, toneStyles[tone].status]}>{status}</Text>
        ) : null}
        <Text style={styles.metricNote}>{note}</Text>
      </View>
      <Text style={[styles.metricValue, toneStyles[tone].value]}>{value}</Text>
    </View>
  );

  if (href) {
    return (
      <Link asChild href={href}>
        <Pressable
          accessibilityRole="button"
          style={StyleSheet.flatten([styles.metricCard, toneStyles[tone].card])}
        >
          {content}
        </Pressable>
      </Link>
    );
  }

  return <View style={[styles.metricCard, toneStyles[tone].card]}>{content}</View>;
}

export function ActionPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.actionPanel}>
      <Text style={styles.actionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ActionGrid({ children }: { children: ReactNode }) {
  return <View style={styles.actionGrid}>{children}</View>;
}

export function ActionLink({
  href,
  label,
  primary = false,
}: {
  href: Href;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link asChild href={href}>
      <Pressable
        accessibilityRole="button"
        style={StyleSheet.flatten([
          styles.actionLink,
          primary ? styles.primaryActionLink : null,
        ])}
      >
        <Text style={[styles.actionLinkText, primary && styles.primaryActionLinkText]}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function EmptyState({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
  },
  description: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 164,
    flexGrow: 1,
    minHeight: 112,
    minWidth: 158,
    padding: spacing.md,
  },
  metricContent: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    width: "100%",
  },
  metricTextGroup: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 14,
    textTransform: "uppercase",
  },
  metricStatus: {
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    minWidth: 52,
    textAlign: "right",
  },
  metricNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  actionPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actionLink: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 52,
    minWidth: 160,
    padding: spacing.md,
  },
  primaryActionLink: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionLinkText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  primaryActionLinkText: {
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
