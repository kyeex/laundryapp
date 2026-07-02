import { Platform } from "react-native";

import { colors } from "@/theme/colors";

export const roleStackScreenOptions = {
  headerBackTitle: "Back",
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.text,
  headerTitleAlign: Platform.select({
    default: "center",
    web: "left",
  }) as "center" | "left",
  headerTitleStyle: {
    fontWeight: "800" as const,
  },
};
