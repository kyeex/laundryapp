import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { ConfigNotice } from "@/components/ProtectedRoute";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export default function SignInScreen() {
  const { isConfigured, isDemoMode, signInWithEmail, startDemoSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
    } catch (signInError) {
      const message =
        signInError instanceof Error
          ? signInError.message
          : "Unable to sign in right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.body}>
          Access your customer, owner, driver, or admin workspace.
        </Text>
        <ConfigNotice />
        <FormTextInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <FormTextInput
          label="Password"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          disabled={!isConfigured || isSubmitting || !email || !password}
          label={isSubmitting ? "Signing in..." : "Sign in"}
          onPress={handleSubmit}
        />
        {isDemoMode ? (
          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Explore with demo data</Text>
            <Text style={styles.demoText}>
              Pick a role to enter the seeded workflow. You can switch roles
              later from the account panel without signing out.
            </Text>
            <AppButton
              label="Demo customer"
              onPress={() => startDemoSession("customer")}
              variant="secondary"
            />
            <AppButton
              label="Demo owner"
              onPress={() => startDemoSession("owner")}
              variant="secondary"
            />
            <AppButton
              label="Demo driver"
              onPress={() => startDemoSession("driver")}
              variant="secondary"
            />
            <AppButton
              label="Demo admin"
              onPress={() => startDemoSession("admin")}
              variant="secondary"
            />
          </View>
        ) : null}
        <Link href="/(auth)/create-account" style={styles.link}>
          Create account
        </Link>
        <Link href="/(auth)/forgot-password" style={styles.link}>
          Forgot password
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: "700",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  demoBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  demoTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  demoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
