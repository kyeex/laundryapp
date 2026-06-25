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
    paymentMethod: {
      cardholderName: "",
      brand: "",
      last4: "",
      expirationMonth: "",
      expirationYear: "",
    },
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
      const savedProfile = await saveCustomerProfileSummary(currentUser.id, {
        ...profile,
        defaultAddress: {
          ...profile.defaultAddress,
          label: profile.defaultAddress.label.trim() || "Home",
        },
      });
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

  const address = profile.defaultAddress;
  const contactComplete = Boolean(profile.displayName && profile.email && profile.phone);
  const addressComplete = Boolean(
    address.street1 && address.city && address.state && address.postalCode,
  );
  const profileReady = contactComplete && addressComplete;

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
            <View style={styles.readinessPanel}>
              <View style={styles.readinessCopy}>
                <Text style={styles.eyebrow}>Profile readiness</Text>
                <Text style={styles.readinessTitle}>
                  {profileReady ? "Ready for checkout" : "A few details need attention"}
                </Text>
                <Text style={styles.readinessText}>
                  These details help prefill new orders and reduce repeated typing.
                </Text>
              </View>
              <View style={styles.readinessStatusRow}>
                <Text
                  style={[
                    styles.statusPill,
                    contactComplete ? styles.statusPillComplete : styles.statusPillOpen,
                  ]}
                >
                  Contact {contactComplete ? "complete" : "needed"}
                </Text>
                <Text
                  style={[
                    styles.statusPill,
                    addressComplete ? styles.statusPillComplete : styles.statusPillOpen,
                  ]}
                >
                  Address {addressComplete ? "complete" : "needed"}
                </Text>
              </View>
            </View>

            <View style={styles.formPanel}>
              <View style={styles.formPanelHeader}>
                <Text style={styles.eyebrow}>Account details</Text>
                <Text style={styles.formPanelTitle}>Contact information</Text>
                <Text style={styles.formPanelDescription}>
                  Keep your name, email, and phone current for order updates.
                </Text>
              </View>
              <View style={styles.formFields}>
                <FormTextInput
                  label="Name"
                  onChangeText={(value) => updateProfileField("displayName", value)}
                  placeholder="Name"
                  value={profile.displayName}
                />
                <View style={styles.responsiveRow}>
                  <View style={styles.flexField}>
                    <FormTextInput
                      inputMode="email"
                      label="Email"
                      onChangeText={(value) => updateProfileField("email", value)}
                      placeholder="Email"
                      value={profile.email}
                    />
                  </View>
                  <View style={styles.flexField}>
                    <FormTextInput
                      inputMode="tel"
                      label="Phone"
                      onChangeText={(value) => updateProfileField("phone", value)}
                      placeholder="Phone"
                      value={profile.phone}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.formPanel}>
              <View style={styles.formPanelHeader}>
                <Text style={styles.eyebrow}>Service address</Text>
                <Text style={styles.formPanelTitle}>Default address</Text>
                <Text style={styles.formPanelDescription}>
                  This address can prefill pickup and delivery details on new orders.
                </Text>
              </View>
              <View style={styles.formFields}>
                <View style={styles.addressLineGroup}>
                  <FormTextInput
                    label="Street address"
                    onChangeText={(value) => updateAddress("street1", value)}
                    placeholder="Street address"
                    value={profile.defaultAddress.street1}
                  />
                  <FormTextInput
                    label="Apt, suite, unit"
                    onChangeText={(value) => updateAddress("street2", value)}
                    placeholder="Apt, suite, unit"
                    value={profile.defaultAddress.street2}
                  />
                </View>
                <View style={styles.addressLocationRow}>
                  <View style={styles.addressCityField}>
                    <FormTextInput
                      label="City"
                      onChangeText={(value) => updateAddress("city", value)}
                      placeholder="City"
                      value={profile.defaultAddress.city}
                    />
                  </View>
                  <View style={styles.addressStateField}>
                    <FormTextInput
                      label="State"
                      maxLength={2}
                      onChangeText={(value) => updateAddress("state", value)}
                      placeholder="State"
                      value={profile.defaultAddress.state}
                    />
                  </View>
                  <View style={styles.addressZipField}>
                    <FormTextInput
                      label="ZIP code"
                      onChangeText={(value) => updateAddress("postalCode", value)}
                      placeholder="ZIP code"
                      value={profile.defaultAddress.postalCode}
                    />
                  </View>
                </View>
                <FormTextInput
                  label="Delivery instructions"
                  multiline
                  onChangeText={(value) => updateAddress("deliveryInstructions", value)}
                  placeholder="Gate code, pickup notes, delivery instructions..."
                  style={styles.textArea}
                  value={profile.defaultAddress.deliveryInstructions}
                />
              </View>
            </View>

            <View style={styles.savePanel}>
              <View style={styles.saveCopy}>
                <Text style={styles.saveTitle}>Save profile details</Text>
                <Text style={styles.saveText}>
                  Changes apply to future orders and customer checkout defaults.
                </Text>
              </View>
              <AppButton
                disabled={isSaving}
                label={isSaving ? "Saving..." : "Save profile summary"}
                onPress={handleSaveProfile}
              />
            </View>
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
  readinessPanel: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  readinessCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 240,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  readinessTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  readinessText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  readinessStatusRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusPill: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  statusPillComplete: {
    backgroundColor: "#DCFCE7",
    color: colors.success,
  },
  statusPillOpen: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  formPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  formPanelHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  formPanelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  formPanelDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  formFields: {
    gap: spacing.sm,
  },
  responsiveRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  flexField: {
    flex: 1,
    minWidth: 220,
  },
  addressLineGroup: {
    gap: spacing.sm,
  },
  addressLocationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  addressCityField: {
    flex: 2,
    minWidth: 180,
  },
  addressStateField: {
    flex: 1,
    minWidth: 104,
  },
  addressZipField: {
    flex: 1,
    minWidth: 136,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  savePanel: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  saveCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  saveTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  saveText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
