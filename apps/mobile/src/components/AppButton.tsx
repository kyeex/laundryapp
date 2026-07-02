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
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.secondary,
        pressed && !disabled && styles.pressed,
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
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    shadowOpacity: 0.05,
  },
  pressed: {
    opacity: 0.86,
    transform: [
      {
        scale: 0.99,
      },
    ],
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
    textAlign: "center",
  },
  secondaryLabel: {
    color: colors.text,
  },
  disabledLabel: {
    color: colors.muted,
  },
});
