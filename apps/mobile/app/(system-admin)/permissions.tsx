import { StyleSheet, Text, View } from "react-native";

import { PageHeader, SectionCard } from "@/components/OperatingDashboard";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { UserRole } from "@/types/domain";

const permissionGroups: Array<{
  role: UserRole;
  title: string;
  permissions: string[];
}> = [
  {
    role: "customer",
    title: "Customer",
    permissions: [
      "Create and review laundry orders",
      "Manage profile, address, and laundry preferences",
      "Track order progress and complete payment steps",
    ],
  },
  {
    role: "owner",
    title: "Owner",
    permissions: [
      "Accept, decline, price, and manage orders",
      "Manage pricing catalog and service availability",
      "Create batches and review driver-submitted routes",
    ],
  },
  {
    role: "driver",
    title: "Driver",
    permissions: [
      "View assigned pickup and delivery batches",
      "Mark route stops complete or failed",
      "Finalize and submit completed route activity",
    ],
  },
  {
    role: "admin",
    title: "Admin",
    permissions: [
      "View users registered in the system",
      "Create provisioned users through secure admin workflows",
      "Reset passwords and manage active status or role assignment",
    ],
  },
];

export default function SystemAdminPermissionsScreen() {
  return (
    <Screen>
      <View style={styles.content}>
        <PageHeader
          eyebrow="Admin tools"
          title="Permission settings"
          description="This is the first version of the permissions model. It documents the role boundaries we are enforcing now and prepares the app for editable permission policies later."
        />

        {permissionGroups.map((group) => (
          <SectionCard key={group.role} title={group.title}>
            {group.permissions.map((permission) => (
              <View key={permission} style={styles.permissionRow}>
                <View style={styles.dot} />
                <Text style={styles.permissionText}>{permission}</Text>
              </View>
            ))}
          </SectionCard>
        ))}

        <View style={styles.note}>
          <Text style={styles.noteTitle}>Next production step</Text>
          <Text style={styles.noteText}>
            Store permission policies in Firestore or custom claims, then enforce
            them in security rules and Cloud Functions. The UI can become editable
            once those backend guarantees exist.
          </Text>
        </View>
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
  permissionRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  permissionText: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  noteText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
