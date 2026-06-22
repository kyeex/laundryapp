import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { getHomeRouteForRole } from "@/utils/authRouting";

const roleLinks = [
  { href: "/(auth)/sign-in", label: "Sign in" },
  { href: "/(customer)", label: "Customer" },
  { href: "/(admin)", label: "Owner" },
  { href: "/(driver)", label: "Driver" },
  { href: "/(system-admin)", label: "Admin" },
] as const;

export default function WelcomeScreen() {
  const { currentUser } = useAuth();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Laundry delivery</Text>
        <Text style={styles.title}>Fresh orders, clean workflow.</Text>
        <Text style={styles.subtitle}>
          Customer requests, owner operations, driver routes, and admin controls
          for production readiness.
        </Text>
      </View>

      <View style={styles.links}>
        {currentUser ? (
          <Link href={getHomeRouteForRole(currentUser.role)} style={styles.link}>
            Continue as {currentUser.role}
          </Link>
        ) : null}
        {roleLinks.map((item) => (
          <Link key={item.href} href={item.href} style={styles.link}>
            {item.label}
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 42,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 25,
  },
  links: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  link: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    padding: spacing.md,
  },
});
