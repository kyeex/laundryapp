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

export default function CreateAccountScreen() {
  const { createAccountWithEmail, isConfigured } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError("");
    setIsSubmitting(true);

    try {
      await createAccountWithEmail({
        displayName,
        email,
        password,
        phone,
        role: "customer",
      });
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Unable to create this account right now.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isDisabled =
    isSubmitting || !displayName.trim() || !email.trim() || !password.trim();

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.body}>
          Customer accounts can be created here. Owner, driver, and admin
          accounts should be provisioned by the business.
        </Text>
        {!isConfigured ? (
          <Text style={styles.demoText}>
            Demo mode is active, so this creates a local customer profile for
            testing. No real account or password is saved until Firebase is
            configured.
          </Text>
        ) : null}
        <ConfigNotice />
        <FormTextInput
          label="Full name"
          onChangeText={setDisplayName}
          placeholder="Jane Customer"
          value={displayName}
        />
        <FormTextInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <FormTextInput
          keyboardType="phone-pad"
          label="Phone"
          onChangeText={setPhone}
          placeholder="555-555-5555"
          value={phone}
        />
        <FormTextInput
          label="Password"
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          disabled={isDisabled}
          label={isSubmitting ? "Creating..." : "Create account"}
          onPress={handleSubmit}
        />
        <Link href="/(auth)/sign-in" style={styles.link}>
          Already have an account?
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
  demoText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
});
