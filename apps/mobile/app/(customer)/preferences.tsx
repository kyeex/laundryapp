import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  getCustomerLaundryPreferences,
  saveCustomerLaundryPreferences,
  type CustomerLaundryPreferences,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

function createEmptyPreferences(): CustomerLaundryPreferences {
  return {
    detergentPreference: "",
    fabricSoftenerPreference: "",
    foldingPreference: "",
    hangerPreference: "",
    scentPreference: "",
    separationPreference: "",
    specialInstructions: "",
  };
}

export default function CustomerPreferencesScreen() {
  const { currentUser } = useAuth();
  const [preferences, setPreferences] =
    useState<CustomerLaundryPreferences>(createEmptyPreferences);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const loadedPreferences = await getCustomerLaundryPreferences(currentUser.id);
      setPreferences(loadedPreferences);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load customer preferences right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  function updatePreference(field: keyof CustomerLaundryPreferences, value: string) {
    setPreferences((current) => ({ ...current, [field]: value }));
  }

  async function handleSavePreferences() {
    if (!currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const savedPreferences = await saveCustomerLaundryPreferences(
        currentUser.id,
        preferences,
      );
      setPreferences(savedPreferences);
      setSuccess("Customer preferences saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save customer preferences right now.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Customer preferences</Text>
          <Text style={styles.body}>
            Save laundry preferences that should automatically populate new orders.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Laundry care</Text>
              <FormTextInput
                label="Detergent preference"
                onChangeText={(value) => updatePreference("detergentPreference", value)}
                value={preferences.detergentPreference}
              />
              <FormTextInput
                label="Fabric softener preference"
                onChangeText={(value) =>
                  updatePreference("fabricSoftenerPreference", value)
                }
                value={preferences.fabricSoftenerPreference}
              />
              <FormTextInput
                label="Scent preference"
                onChangeText={(value) => updatePreference("scentPreference", value)}
                value={preferences.scentPreference}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Finishing preferences</Text>
              <FormTextInput
                label="Folding preference"
                onChangeText={(value) => updatePreference("foldingPreference", value)}
                value={preferences.foldingPreference}
              />
              <FormTextInput
                label="Hanger preference"
                onChangeText={(value) => updatePreference("hangerPreference", value)}
                value={preferences.hangerPreference}
              />
              <FormTextInput
                label="Separation preference"
                onChangeText={(value) => updatePreference("separationPreference", value)}
                value={preferences.separationPreference}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Special instructions</Text>
              <FormTextInput
                label="Order notes template"
                multiline
                onChangeText={(value) => updatePreference("specialInstructions", value)}
                style={styles.textArea}
                value={preferences.specialInstructions}
              />
            </View>

            <AppButton
              disabled={isSaving}
              label={isSaving ? "Saving..." : "Save customer preferences"}
              onPress={handleSavePreferences}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.xs,
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top",
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
