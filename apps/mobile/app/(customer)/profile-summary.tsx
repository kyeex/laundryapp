import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  getCustomerProfileSummary,
  saveCustomerProfileSummary,
  type CustomerProfileSummary,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AddressInput } from "@/types/domain";

const emptyAddress: AddressInput = {
  label: "Home",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
  deliveryInstructions: "",
};

function createEmptyProfile(): CustomerProfileSummary {
  return {
    displayName: "",
    phone: "",
    email: "",
    defaultAddress: emptyAddress,
  };
}

export default function CustomerProfileSummaryScreen() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<CustomerProfileSummary>(createEmptyProfile);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const loadedProfile = await getCustomerProfileSummary(currentUser.id);
      setProfile(loadedProfile);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load profile summary right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  function updateProfileField(field: "displayName" | "phone" | "email", value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateAddress(field: keyof AddressInput, value: string) {
    setProfile((current) => ({
      ...current,
      defaultAddress: {
        ...current.defaultAddress,
        [field]: value,
      },
    }));
  }

  async function handleSaveProfile() {
    if (!currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const savedProfile = await saveCustomerProfileSummary(currentUser.id, profile);
      setProfile(savedProfile);
      setSuccess("Customer profile saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save profile summary right now.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Customer profile summary</Text>
          <Text style={styles.body}>
            Review and update your contact information and default service address.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact</Text>
              <FormTextInput
                label="Name"
                onChangeText={(value) => updateProfileField("displayName", value)}
                value={profile.displayName}
              />
              <FormTextInput
                inputMode="email"
                label="Email"
                onChangeText={(value) => updateProfileField("email", value)}
                value={profile.email}
              />
              <FormTextInput
                inputMode="tel"
                label="Phone"
                onChangeText={(value) => updateProfileField("phone", value)}
                value={profile.phone}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Default address</Text>
              <FormTextInput
                label="Address label"
                onChangeText={(value) => updateAddress("label", value)}
                value={profile.defaultAddress.label}
              />
              <FormTextInput
                label="Street address"
                onChangeText={(value) => updateAddress("street1", value)}
                value={profile.defaultAddress.street1}
              />
              <FormTextInput
                label="Apt, suite, unit"
                onChangeText={(value) => updateAddress("street2", value)}
                value={profile.defaultAddress.street2}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormTextInput
                    label="City"
                    onChangeText={(value) => updateAddress("city", value)}
                    value={profile.defaultAddress.city}
                  />
                </View>
                <View style={styles.stateItem}>
                  <FormTextInput
                    label="State"
                    maxLength={2}
                    onChangeText={(value) => updateAddress("state", value)}
                    value={profile.defaultAddress.state}
                  />
                </View>
              </View>
              <FormTextInput
                label="ZIP code"
                onChangeText={(value) => updateAddress("postalCode", value)}
                value={profile.defaultAddress.postalCode}
              />
              <FormTextInput
                label="Delivery instructions"
                multiline
                onChangeText={(value) => updateAddress("deliveryInstructions", value)}
                style={styles.textArea}
                value={profile.defaultAddress.deliveryInstructions}
              />
            </View>

            <AppButton
              disabled={isSaving}
              label={isSaving ? "Saving..." : "Save profile summary"}
              onPress={handleSaveProfile}
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
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  stateItem: {
    width: 96,
  },
  textArea: {
    minHeight: 92,
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
