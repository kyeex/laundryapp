import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type SelectableOptionProps = {
  title: string;
  description?: string;
  disabled?: boolean;
  meta?: string;
  selected: boolean;
  onPress: () => void;
};

export function SelectableOption({
  description,
  disabled = false,
  meta,
  onPress,
  selected,
  title,
}: SelectableOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, selected && styles.selected, disabled && styles.disabled]}
    >
      <View style={styles.textWrap}>
        <Text
          style={[
            styles.title,
            selected && styles.selectedText,
            disabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={[
              styles.description,
              selected && styles.selectedMuted,
              disabled && styles.disabledText,
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text
          style={[
            styles.meta,
            selected && styles.selectedText,
            disabled && styles.disabledText,
          ]}
        >
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 72,
    padding: spacing.md,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  textWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  meta: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedText: {
    color: colors.onPrimary,
  },
  selectedMuted: {
    color: "#D1FAE5",
  },
  disabledText: {
    color: "#9CA3AF",
  },
});
