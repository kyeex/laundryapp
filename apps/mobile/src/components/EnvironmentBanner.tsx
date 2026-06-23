import { StyleSheet, Text, View } from "react-native";

import { appEnvironment } from "@/config/runtime";
import {
  firebaseConfig,
  isDemoPreviewMode,
  shouldUseDemoBackend,
} from "@/config/firebase";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

function getBannerContent() {
  if (isDemoPreviewMode) {
    return {
      title: "Role preview",
      text: "Local demo data only. Real staging data is not changed.",
      tone: "warning" as const,
    };
  }

  if (shouldUseDemoBackend) {
    return {
      title: "Demo mode",
      text: "Local demo data only. No Firebase production records are used.",
      tone: "warning" as const,
    };
  }

  if (appEnvironment === "staging") {
    return {
      title: "Staging environment",
      text: `Firebase project: ${firebaseConfig.projectId ?? "not configured"}. Use test data and test payment keys only.`,
      tone: "info" as const,
    };
  }

  return null;
}

export function EnvironmentBanner() {
  const content = getBannerContent();

  if (!content) {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        content.tone === "warning" ? styles.warning : styles.info,
      ]}
    >
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.text}>{content.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  info: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  warning: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  text: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
