import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type DemoWalkthroughProps = {
  title: string;
  steps: string[];
};

export function DemoWalkthrough({ steps, title }: DemoWalkthroughProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      {steps.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  stepRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  stepNumber: {
    alignItems: "center",
    backgroundColor: "#CCFBF1",
    borderRadius: 8,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  stepText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
