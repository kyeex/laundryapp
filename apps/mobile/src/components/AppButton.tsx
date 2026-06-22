import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
};

export function AppButton({
  disabled = false,
  label,
  onPress,
  variant = "primary",
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant === "secondary" && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === "secondary" && styles.secondaryLabel,
          disabled && styles.disabledLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  secondaryLabel: {
    color: colors.text,
  },
  disabledLabel: {
    color: colors.muted,
  },
});
