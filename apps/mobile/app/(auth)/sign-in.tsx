import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { ConfigNotice } from "@/components/ProtectedRoute";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export default function SignInScreen() {
  const {
    isConfigured,
    isDemoMode,
    isDemoPreviewMode,
    signInWithEmail,
    startDemoSession,
    stopDemoPreviewSession,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const hasCredentials = Boolean(email.trim()) && Boolean(password);
  const canSubmit = !isSubmitting && hasCredentials;

  async function handleSubmit() {
    if (isSubmitting || !hasCredentials) {
      return;
    }

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

  function handleEmailKeyPress(
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (event.nativeEvent.key === "Enter") {
      passwordInputRef.current?.focus();
    }
  }

  function handlePasswordKeyPress(
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) {
    if (event.nativeEvent.key === "Enter") {
      void handleSubmit();
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
        {isDemoPreviewMode ? (
          <View style={styles.demoPreviewNotice}>
            <Text style={styles.demoPreviewTitle}>Demo preview is active</Text>
            <Text style={styles.demoPreviewText}>
              Exit demo preview before signing in with a real Firebase account.
            </Text>
            <AppButton
              label="Exit demo preview"
              onPress={stopDemoPreviewSession}
              variant="secondary"
            />
          </View>
        ) : null}
        <FormTextInput
          autoCapitalize="none"
          blurOnSubmit={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          onKeyPress={handleEmailKeyPress}
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          placeholder="you@example.com"
          returnKeyType="next"
          value={email}
        />
        <FormTextInput
          label="Password"
          onChangeText={setPassword}
          onKeyPress={handlePasswordKeyPress}
          onSubmitEditing={handleSubmit}
          placeholder="Password"
          ref={passwordInputRef}
          returnKeyType="done"
          secureTextEntry
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          disabled={!canSubmit}
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
  demoPreviewNotice: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  demoPreviewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  demoPreviewText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
