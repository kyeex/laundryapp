import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type FormTextInputProps = TextInputProps & {
  label: string;
};

export const FormTextInput = forwardRef<TextInput, FormTextInputProps>(
  function FormTextInput({ label, style, ...props }, ref) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        ref={ref}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 2,
      width: 0,
    },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
});
