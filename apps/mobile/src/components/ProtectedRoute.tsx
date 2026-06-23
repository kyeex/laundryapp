import { Redirect } from "expo-router";
import { PropsWithChildren } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { UserRole } from "@/types/domain";
import { getHomeRouteForRole } from "@/utils/authRouting";

type ProtectedRouteProps = PropsWithChildren<{
  allowedRoles: UserRole[];
}>;

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { currentUser, isConfigured, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isConfigured && !currentUser) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!currentUser) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Redirect href={getHomeRouteForRole(currentUser.role)} />;
  }

  return children;
}

export function ConfigNotice() {
  const { appEnvironment, isConfigured, isDemoMode } = useAuth();

  if (isConfigured || isDemoMode) {
    return null;
  }

  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>Firebase setup needed</Text>
      <Text style={styles.noticeText}>
        This build is running in {appEnvironment} mode. Add Firebase values to
        apps/mobile/.env before using real authentication or Firestore data.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
  notice: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  noticeText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
