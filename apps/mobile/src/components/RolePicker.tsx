import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { UserRole } from "@/types/domain";

const signupRoles: Exclude<UserRole, "owner" | "admin">[] = ["customer", "driver"];

type RolePickerProps = {
  value: Exclude<UserRole, "owner" | "admin">;
  onChange: (role: Exclude<UserRole, "owner" | "admin">) => void;
};

export function RolePicker({ onChange, value }: RolePickerProps) {
  return (
    <View style={styles.container}>
      {signupRoles.map((role) => {
        const selected = role === value;

        return (
          <Pressable
            accessibilityRole="button"
            key={role}
            onPress={() => onChange(role)}
            style={[styles.option, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {role === "customer" ? "Customer" : "Driver"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  option: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 48,
    justifyContent: "center",
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  selectedLabel: {
    color: colors.onPrimary,
  },
});
