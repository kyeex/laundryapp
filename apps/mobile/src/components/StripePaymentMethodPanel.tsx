import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { SavedStripePaymentMethod } from "@/types/domain";

type StripePaymentMethodPanelProps = {
  customerEmail: string;
  customerName: string;
  disabled?: boolean;
  estimatedTotal: number;
  onSaved: (paymentMethod: SavedStripePaymentMethod) => void;
};

export function StripePaymentMethodPanel(_props: StripePaymentMethodPanelProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Secure card authorization</Text>
      <Text style={styles.muted}>
        Stripe payment collection is available in the web and native mobile builds.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
