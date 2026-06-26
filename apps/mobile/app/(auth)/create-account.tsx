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
import { formatPhoneNumberInput } from "@/utils/phoneFormat";

export default function CreateAccountScreen() {
  const { createAccountWithEmail, isDemoMode } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailInputRef = useRef<TextInput>(null);
  const phoneInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const hasRequiredFields =
    Boolean(displayName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(password.trim()) &&
    Boolean(confirmPassword.trim());
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = !isSubmitting && hasRequiredFields && passwordsMatch;
  const passwordTips = [
    {
      met: password.length >= 8,
      text: "Use at least 8 characters.",
    },
    {
      met: /[A-Z]/.test(password) && /[a-z]/.test(password),
      text: "Mix uppercase and lowercase letters.",
    },
    {
      met: /\d/.test(password),
      text: "Add at least one number.",
    },
    {
      met: /[^A-Za-z0-9]/.test(password),
      text: "Add a symbol for extra protection.",
    },
  ];

  async function handleSubmit() {
    if (!canSubmit) {
      if (hasRequiredFields && !passwordsMatch) {
        setError("Password and confirmation password must match.");
      }

      return;
    }

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

  function handleEnterKey(
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
    nextAction: () => void,
  ) {
    if (event.nativeEvent.key === "Enter") {
      nextAction();
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.body}>
          Customer accounts can be created here. Owner, driver, and admin
          accounts should be provisioned by the business.
        </Text>
        {isDemoMode ? (
          <Text style={styles.demoText}>
            Demo mode is active, so this creates a local customer profile for
            testing. No real account or password is saved until Firebase is
            configured.
          </Text>
        ) : null}
        <ConfigNotice />
        <FormTextInput
          blurOnSubmit={false}
          label="Full name"
          onChangeText={setDisplayName}
          onKeyPress={(event) =>
            handleEnterKey(event, () => emailInputRef.current?.focus())
          }
          onSubmitEditing={() => emailInputRef.current?.focus()}
          placeholder="Jane Customer"
          returnKeyType="next"
          value={displayName}
        />
        <FormTextInput
          autoCapitalize="none"
          blurOnSubmit={false}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          onKeyPress={(event) =>
            handleEnterKey(event, () => phoneInputRef.current?.focus())
          }
          onSubmitEditing={() => phoneInputRef.current?.focus()}
          placeholder="you@example.com"
          ref={emailInputRef}
          returnKeyType="next"
          value={email}
        />
        <FormTextInput
          blurOnSubmit={false}
          keyboardType="phone-pad"
          label="Phone"
          onChangeText={(value) => setPhone(formatPhoneNumberInput(value))}
          onKeyPress={(event) =>
            handleEnterKey(event, () => passwordInputRef.current?.focus())
          }
          onSubmitEditing={() => passwordInputRef.current?.focus()}
          placeholder="555-555-5555"
          ref={phoneInputRef}
          returnKeyType="next"
          value={phone}
        />
        <FormTextInput
          label="Password"
          onChangeText={setPassword}
          onKeyPress={(event) =>
            handleEnterKey(event, () => confirmPasswordInputRef.current?.focus())
          }
          onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
          placeholder="At least 6 characters"
          ref={passwordInputRef}
          returnKeyType="next"
          secureTextEntry
          value={password}
        />
        <View style={styles.passwordHelp}>
          <Text style={styles.passwordHelpTitle}>Password strength ideas</Text>
          {passwordTips.map((tip) => (
            <Text
              key={tip.text}
              style={[
                styles.passwordHelpText,
                tip.met && styles.passwordHelpTextMet,
              ]}
            >
              {tip.met ? "Met: " : "Tip: "}
              {tip.text}
            </Text>
          ))}
          <Text style={styles.passwordHelpNote}>
            These are suggestions for now. The only required step is matching
            the confirmation password.
          </Text>
        </View>
        <FormTextInput
          label="Confirm password"
          onChangeText={setConfirmPassword}
          onKeyPress={(event) => handleEnterKey(event, () => void handleSubmit())}
          onSubmitEditing={handleSubmit}
          placeholder="Re-enter password"
          ref={confirmPasswordInputRef}
          returnKeyType="done"
          secureTextEntry
          value={confirmPassword}
        />
        {confirmPassword.length > 0 && !passwordsMatch ? (
          <Text style={styles.error}>Password and confirmation password must match.</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          disabled={!canSubmit}
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
  passwordHelp: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
    borderRadius: 10,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  passwordHelpTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  passwordHelpText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  passwordHelpTextMet: {
    color: colors.success,
    fontWeight: "700",
  },
  passwordHelpNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
});
