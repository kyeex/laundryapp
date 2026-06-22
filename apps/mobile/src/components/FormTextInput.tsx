import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type FormTextInputProps = TextInputProps & {
  label: string;
};

export function FormTextInput({ label, style, ...props }: FormTextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
