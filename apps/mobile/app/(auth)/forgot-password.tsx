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

export default function ForgotPasswordScreen() {
  const { isConfigured, isDemoMode, sendResetEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (isConfigured) {
        await sendResetEmail(email);
        setMessage(
          "If an account exists for that email, a password reset link has been sent.",
        );
      } else if (isDemoMode) {
        setMessage(
          "Demo mode: password reset request captured. Configure Firebase to send real reset emails.",
        );
      } else {
        throw new Error("Firebase must be configured before reset emails can be sent.");
      }
    } catch (resetError) {
      const resetMessage =
        resetError instanceof Error
          ? resetError.message
          : "Unable to send a reset email right now.";
      setError(resetMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.body}>
          Enter your email and we will send a password reset link if the account
          exists.
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <AppButton
          disabled={isSubmitting || !email.trim()}
          label={isSubmitting ? "Sending..." : "Send reset email"}
          onPress={handleSubmit}
        />
        <Link href="/(auth)/sign-in" style={styles.link}>
          Back to sign in
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
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
});
