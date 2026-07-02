import { Link, router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

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

export function MetricGrid({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metricGrid, compact && styles.metricGridCompact]}>
      {children}
    </View>
  );
}

export function MetricCard({
  compact = false,
  href,
  label,
  note,
  status,
  tone = "neutral",
  value,
}: {
  compact?: boolean;
  href?: Href;
  label: string;
  note: string;
  status?: string;
  tone?: Tone;
  value: string;
}) {
  const content = (
    <View style={[styles.metricContent, compact && styles.metricContentCompact]}>
      <View style={styles.metricTextGroup}>
        <Text style={[styles.metricLabel, compact && styles.metricLabelCompact]}>
          {label}
        </Text>
        {status ? (
          <Text style={[styles.metricStatus, toneStyles[tone].status]}>{status}</Text>
        ) : null}
        <Text
          numberOfLines={compact ? 2 : undefined}
          style={[styles.metricNote, compact && styles.metricNoteCompact]}
        >
          {note}
        </Text>
      </View>
      <Text style={[styles.metricValue, toneStyles[tone].value, compact && styles.metricValueCompact]}>
        {value}
      </Text>
    </View>
  );

  if (href) {
    return (
      <Link asChild href={href}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) =>
            StyleSheet.flatten([
              styles.metricCard,
              compact ? styles.metricCardCompact : null,
              toneStyles[tone].card,
              pressed ? styles.pressed : null,
            ])
          }
        >
          {content}
        </Pressable>
      </Link>
    );
  }

  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact, toneStyles[tone].card]}>
      {content}
    </View>
  );
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

export function SectionHeader({
  description,
  title,
}: {
  description?: string;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function SectionCard({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <View style={styles.sectionCard}>
      {title ? <SectionHeader description={description} title={title} /> : null}
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
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.actionLink,
          primary ? styles.primaryActionLink : null,
          pressed ? styles.pressed : null,
        ])
      }
    >
      <Text style={[styles.actionLinkText, primary && styles.primaryActionLinkText]}>
        {label}
      </Text>
    </Pressable>
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

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: Tone | "danger";
}) {
  return (
    <Text style={[styles.statusPill, statusToneStyles[tone]]}>{label}</Text>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const statusToneStyles = {
  neutral: {},
  attention: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
    color: "#92400E",
  },
  info: {
    backgroundColor: "#EFF6FF",
    borderColor: "#60A5FA",
    color: "#1D4ED8",
  },
  success: {
    backgroundColor: "#ECFDF5",
    borderColor: "#34D399",
    color: "#047857",
  },
  accent: {
    backgroundColor: "#F5F3FF",
    borderColor: "#A78BFA",
    color: "#6D28D9",
  },
  danger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    color: colors.danger,
  },
} satisfies Record<Tone | "danger", object>;

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    paddingHorizontal: Platform.select({
      default: spacing.xs,
      web: 0,
    }),
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
    fontSize: Platform.select({
      default: 30,
      web: 32,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 36,
      web: 38,
    }),
  },
  description: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 15,
      web: 16,
    }),
    lineHeight: Platform.select({
      default: 22,
      web: 24,
    }),
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.select({
      default: 10,
      web: spacing.sm,
    }),
  },
  metricGridCompact: {
    gap: Platform.select({
      default: spacing.xs,
      web: spacing.sm,
    }),
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: Platform.select({
      default: "47%",
      web: 164,
    }),
    flexGrow: 1,
    minHeight: Platform.select({
      default: 96,
      web: 112,
    }),
    minWidth: Platform.select({
      default: 0,
      web: 158,
    }),
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.08,
      web: 0,
    }),
    shadowRadius: 8,
    elevation: Platform.select({
      default: 2,
      web: 0,
    }),
  },
  metricCardCompact: {
    borderLeftWidth: 4,
    flexBasis: Platform.select({
      default: "47%",
      web: 148,
    }),
    minHeight: Platform.select({
      default: 70,
      web: 78,
    }),
    padding: Platform.select({
      default: 7,
      web: spacing.sm,
    }),
  },
  metricContent: {
    alignItems: "center",
    flexDirection: Platform.select({
      default: "column-reverse",
      web: "row",
    }),
    gap: spacing.sm,
    justifyContent: "center",
    width: "100%",
  },
  metricContentCompact: {
    gap: Platform.select({
      default: 3,
      web: spacing.xs,
    }),
  },
  metricTextGroup: {
    flex: Platform.select({
      default: undefined,
      web: 1,
    }),
    gap: spacing.xs,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 10,
      web: 11,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 13,
      web: 14,
    }),
    textAlign: Platform.select({
      default: "center",
      web: "left",
    }),
    textTransform: "uppercase",
  },
  metricLabelCompact: {
    fontSize: Platform.select({
      default: 11,
      web: 11,
    }),
    lineHeight: Platform.select({
      default: 13,
      web: 14,
    }),
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
    fontSize: Platform.select({
      default: 28,
      web: 34,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 32,
      web: 38,
    }),
    minWidth: Platform.select({
      default: 0,
      web: 52,
    }),
    textAlign: "center",
  },
  metricValueCompact: {
    fontSize: Platform.select({
      default: 25,
      web: 28,
    }),
    lineHeight: Platform.select({
      default: 28,
      web: 32,
    }),
  },
  metricNote: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 11,
      web: 13,
    }),
    lineHeight: Platform.select({
      default: 15,
      web: 18,
    }),
    textAlign: Platform.select({
      default: "center",
      web: "left",
    }),
  },
  metricNoteCompact: {
    fontSize: Platform.select({
      default: 12,
      web: 12,
    }),
    fontWeight: "800",
    lineHeight: Platform.select({
      default: 15,
      web: 16,
    }),
  },
  actionPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.sm,
    }),
    padding: Platform.select({
      default: spacing.md,
      web: spacing.md,
    }),
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.06,
      web: 0,
    }),
    shadowRadius: 8,
    elevation: Platform.select({
      default: 1,
      web: 0,
    }),
  },
  actionTitle: {
    color: colors.text,
    fontSize: Platform.select({
      default: 21,
      web: 23,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 27,
      web: 29,
    }),
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  sectionDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.select({
      default: 10,
      web: spacing.sm,
    }),
  },
  actionLink: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: Platform.select({
      default: "47%",
      web: 160,
    }),
    flexGrow: 1,
    justifyContent: "center",
    minHeight: Platform.select({
      default: 60,
      web: 52,
    }),
    minWidth: Platform.select({
      default: 0,
      web: 160,
    }),
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.06,
      web: 0,
    }),
    shadowRadius: 6,
    elevation: Platform.select({
      default: 1,
      web: 0,
    }),
  },
  primaryActionLink: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    flexBasis: Platform.select({
      default: "100%",
      web: "100%",
    }),
    minHeight: Platform.select({
      default: 62,
      web: 56,
    }),
  },
  actionLinkText: {
    color: colors.text,
    fontSize: Platform.select({
      default: 16,
      web: 18,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 21,
      web: 23,
    }),
    textAlign: "center",
  },
  primaryActionLinkText: {
    color: colors.onPrimary,
    fontSize: Platform.select({
      default: 17,
      web: 20,
    }),
    fontWeight: "900",
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.05,
      web: 0,
    }),
    shadowRadius: 6,
    elevation: Platform.select({
      default: 1,
      web: 0,
    }),
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
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 16,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "capitalize",
  },
  detailRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
    minWidth: 120,
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    flex: 2,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    minWidth: 180,
  },
  pressed: {
    opacity: 0.86,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },
});
