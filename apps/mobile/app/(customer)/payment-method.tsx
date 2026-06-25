import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import {
  getCustomerProfileSummary,
  saveCustomerPaymentMethod,
  type CustomerPaymentMethod,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

const emptyPaymentMethod: CustomerPaymentMethod = {
  cardholderName: "",
  brand: "",
  last4: "",
  expirationMonth: "",
  expirationYear: "",
};

export default function CustomerPaymentMethodScreen() {
  const { currentUser } = useAuth();
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>(emptyPaymentMethod);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadPaymentMethod = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const profile = await getCustomerProfileSummary(currentUser.id);
      setPaymentMethod(profile.paymentMethod);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payment method right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadPaymentMethod();
  }, [loadPaymentMethod]);

  function updatePaymentMethod(field: keyof CustomerPaymentMethod, value: string) {
    setPaymentMethod((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSavePaymentMethod() {
    if (!currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const savedPaymentMethod = await saveCustomerPaymentMethod(
        currentUser.id,
        paymentMethod,
      );
      setPaymentMethod(savedPaymentMethod);
      setSuccess("Payment method saved.");
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save payment method right now.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  const hasSavedCard =
    paymentMethod.brand && paymentMethod.last4 && paymentMethod.expirationMonth;

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Payment method</Text>
          <Text style={styles.body}>
            Save a card summary for checkout. This demo stores only card summary
            fields, not a full card number or CVV.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading ? (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Saved payment</Text>
              <Text style={styles.summaryValue}>
                {hasSavedCard
                  ? `${paymentMethod.brand} ending in ${paymentMethod.last4}`
                  : "No saved card summary"}
              </Text>
              <Text style={styles.summaryMeta}>
                {hasSavedCard
                  ? `Expires ${paymentMethod.expirationMonth}/${paymentMethod.expirationYear || "YYYY"}`
                  : "Add the card summary you want available at checkout."}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Card summary</Text>
              <FormTextInput
                label="Cardholder name"
                onChangeText={(value) => updatePaymentMethod("cardholderName", value)}
                value={paymentMethod.cardholderName}
              />
              <FormTextInput
                label="Card brand"
                onChangeText={(value) => updatePaymentMethod("brand", value)}
                placeholder="Visa, Mastercard, Amex"
                value={paymentMethod.brand}
              />
              <FormTextInput
                keyboardType="number-pad"
                label="Last 4 digits"
                maxLength={4}
                onChangeText={(value) => updatePaymentMethod("last4", value)}
                placeholder="4242"
                value={paymentMethod.last4}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Exp month"
                    maxLength={2}
                    onChangeText={(value) =>
                      updatePaymentMethod("expirationMonth", value)
                    }
                    placeholder="06"
                    value={paymentMethod.expirationMonth}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Exp year"
                    maxLength={4}
                    onChangeText={(value) =>
                      updatePaymentMethod("expirationYear", value)
                    }
                    placeholder="2028"
                    value={paymentMethod.expirationYear}
                  />
                </View>
              </View>
            </View>

            <AppButton
              disabled={isSaving}
              label={isSaving ? "Saving..." : "Save payment method"}
              onPress={handleSavePaymentMethod}
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
  summaryCard: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
