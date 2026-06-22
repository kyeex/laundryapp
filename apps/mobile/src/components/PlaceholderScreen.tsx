import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

import { Screen } from "./Screen";

type PlaceholderScreenProps = PropsWithChildren<{
  title: string;
}>;

export function PlaceholderScreen({ children, title }: PlaceholderScreenProps) {
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.body}>{children}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  body: {
    gap: spacing.sm,
  },
});
