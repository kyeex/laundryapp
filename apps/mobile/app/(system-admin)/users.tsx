import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { SelectableOption } from "@/components/SelectableOption";
import { useAuth } from "@/context/AuthContext";
import {
  createManagedUser,
  getManagedUsers,
  sendManagedUserPasswordReset,
  updateManagedUser,
  type ManagedUserInput,
} from "@/services/adminUserService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AppUser, UserRole } from "@/types/domain";
import { formatPhoneNumberInput } from "@/utils/phoneFormat";

const roleOptions: Array<{ label: string; role: UserRole; description: string }> = [
  {
    label: "Customer",
    role: "customer",
    description: "Can place orders, manage preferences, pay, and track status.",
  },
  {
    label: "Owner",
    role: "owner",
    description: "Can manage business orders, pricing, configuration, and batches.",
  },
  {
    label: "Driver",
    role: "driver",
    description: "Can view assigned routes and submit completed stops.",
  },
  {
    label: "Admin",
    role: "admin",
    description: "Can manage users, access, password resets, and platform settings.",
  },
];

const initialForm: ManagedUserInput = {
  displayName: "",
  email: "",
  phone: "",
  role: "customer",
};

type PendingAdminAction =
  | { type: "active"; user: AppUser }
  | { type: "role"; user: AppUser; role: UserRole }
  | { type: "reset"; user: AppUser };

function formatRole(role: UserRole) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "driver") {
    return "Driver";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Customer";
}

function getPendingActionTitle(action: PendingAdminAction) {
  if (action.type === "role") {
    return "Confirm role change";
  }

  if (action.type === "active") {
    return action.user.active ? "Confirm deactivate user" : "Confirm activate user";
  }

  return "Confirm password reset";
}

function getPendingActionLabel(action: PendingAdminAction) {
  if (action.type === "role") {
    return "Confirm role change";
  }

  if (action.type === "active") {
    return action.user.active ? "Confirm deactivate user" : "Confirm activate user";
  }

  return "Send password reset";
}

export default function SystemAdminUsersScreen() {
  const { isConfigured, isDemoMode } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState(initialForm);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [userSearch, setUserSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recentlyCreatedUserId, setRecentlyCreatedUserId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      setUsers(await getManagedUsers());
    } catch (loadError) {
      const loadMessage =
        loadError instanceof Error ? loadError.message : "Unable to load users.";
      setError(loadMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = userSearch.trim().toLowerCase();
    const visibleUsers =
      statusFilter === "active"
        ? users.filter((user) => user.active)
        : statusFilter === "inactive"
          ? users.filter((user) => !user.active)
          : users;

    const searchedUsers = normalizedSearch
      ? visibleUsers.filter((user) =>
          [
            user.displayName,
            user.email,
            user.phone,
            user.role,
            formatRole(user.role),
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch),
        )
      : visibleUsers;

    return [...searchedUsers].sort((firstUser, secondUser) => {
      if (firstUser.id === recentlyCreatedUserId) {
        return -1;
      }

      if (secondUser.id === recentlyCreatedUserId) {
        return 1;
      }

      return firstUser.displayName.localeCompare(secondUser.displayName);
    });
  }, [recentlyCreatedUserId, statusFilter, userSearch, users]);

  async function handleCreateUser() {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      const createdUser = await createManagedUser(form);
      setUsers((currentUsers) => [
        createdUser,
        ...currentUsers.filter((user) => user.id !== createdUser.id),
      ]);
      setRecentlyCreatedUserId(createdUser.id);
      setStatusFilter("all");
      setForm(initialForm);
      setMessage(
        isConfigured
          ? `${createdUser.displayName} was created.`
          : `${createdUser.displayName} was added to the local demo directory.`,
      );
      const refreshedUsers = await getManagedUsers();
      setUsers([
        createdUser,
        ...refreshedUsers.filter((user) => user.id !== createdUser.id),
      ]);
    } catch (createError) {
      const createMessage =
        createError instanceof Error
          ? createError.message
          : "Unable to create this user.";
      setError(createMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(user: AppUser) {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      await updateManagedUser(user.id, { active: !user.active });
      await loadUsers();
      setPendingAction(null);
      setMessage(`${user.displayName || user.email} is now ${user.active ? "inactive" : "active"}.`);
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this user.";
      setError(updateMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRoleChange(user: AppUser, role: UserRole) {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      await updateManagedUser(user.id, { role });
      await loadUsers();
      setPendingAction(null);
      setMessage(`${user.displayName || user.email} is now assigned to ${formatRole(role)}.`);
    } catch (updateError) {
      const updateMessage =
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this user's role.";
      setError(updateMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResetPassword(user: AppUser) {
    setError("");
    setMessage("");
    setIsSaving(true);

    try {
      await sendManagedUserPasswordReset(user.email);
      setMessage(
        isConfigured
          ? `Password reset email sent to ${user.email}.`
          : `Demo reset recorded for ${user.email}. No email is sent in demo mode.`,
      );
      setPendingAction(null);
    } catch (resetError) {
      const resetMessage =
        resetError instanceof Error
          ? resetError.message
          : "Unable to send a password reset.";
      setError(resetMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const canCreate =
    form.displayName.trim().length > 0 && form.email.trim().length > 0 && !isSaving;

  return (
    <Screen>
      <View style={styles.content}>
        <Text style={styles.title}>User management</Text>
        <Text style={styles.body}>
          View signed-up users, create demo users, change roles, activate or
          deactivate accounts, and initiate password recovery.
        </Text>

        {isDemoMode ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Demo mode</Text>
            <Text style={styles.noticeText}>
              User creation and resets are local only. In production, new Auth
              users should be created by a secure Cloud Function.
            </Text>
          </View>
        ) : null}

        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Create user</Text>
          <FormTextInput
            label="Name"
            onChangeText={(displayName) => setForm((current) => ({ ...current, displayName }))}
            placeholder="Alex Rivera"
            value={form.displayName}
          />
          <FormTextInput
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(email) => setForm((current) => ({ ...current, email }))}
            placeholder="alex@example.com"
            value={form.email}
          />
          <FormTextInput
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={(phone) =>
              setForm((current) => ({
                ...current,
                phone: formatPhoneNumberInput(phone),
              }))
            }
            placeholder="555-555-5555"
            value={form.phone}
          />
          <View style={styles.roleGrid}>
            {roleOptions.map((option) => (
              <SelectableOption
                description={option.description}
                key={option.role}
                onPress={() => setForm((current) => ({ ...current, role: option.role }))}
                selected={form.role === option.role}
                title={option.label}
              />
            ))}
          </View>
          <AppButton
            disabled={!canCreate}
            label={isSaving ? "Creating..." : "Create user"}
            onPress={handleCreateUser}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Signed-up users ({filteredUsers.length})
            </Text>
            <AppButton label="Refresh" onPress={loadUsers} variant="secondary" />
          </View>
          <View style={styles.searchPanel}>
            <FormTextInput
              autoCapitalize="none"
              label="Search users"
              onChangeText={setUserSearch}
              placeholder="Search by name, email, phone, or role"
              value={userSearch}
            />
            {userSearch.trim() ? (
              <AppButton
                label="Clear search"
                onPress={() => setUserSearch("")}
                variant="secondary"
              />
            ) : null}
          </View>
          <View style={styles.filterRow}>
            {(["all", "active", "inactive"] as const).map((filter) => (
              <Pressable
                accessibilityRole="button"
                key={filter}
                onPress={() => setStatusFilter(filter)}
                style={[styles.filterButton, statusFilter === filter && styles.filterSelected]}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === filter && styles.filterSelectedText,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>

          {isLoading ? <Text style={styles.muted}>Loading users...</Text> : null}
          {!isLoading && filteredUsers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.muted}>
                No accounts match this view. Clear the search, switch the filter
                back to All, or use Create user above to add a customer, owner,
                driver, or admin demo account.
              </Text>
            </View>
          ) : null}

          {filteredUsers.map((user) => (
            <View
              key={user.id}
              style={[
                styles.userCard,
                user.id === recentlyCreatedUserId && styles.recentUserCard,
              ]}
            >
              <View style={styles.userHeader}>
                <View style={styles.userTitleWrap}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{user.displayName || "Unnamed user"}</Text>
                    {user.id === recentlyCreatedUserId ? (
                      <View style={styles.newPill}>
                        <Text style={styles.newPillText}>New</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.userMeta}>{user.email}</Text>
                  <Text style={styles.userMeta}>{user.phone || "No phone"}</Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    user.active ? styles.activePill : styles.inactivePill,
                  ]}
                >
                  <Text style={styles.statusText}>{user.active ? "Active" : "Inactive"}</Text>
                </View>
              </View>
              <Text style={styles.roleLabel}>Role: {formatRole(user.role)}</Text>
              <View style={styles.compactRoleGrid}>
                {roleOptions.map((option) => (
                  <Pressable
                    accessibilityRole="button"
                    key={option.role}
                    onPress={() =>
                      user.role === option.role
                        ? undefined
                        : setPendingAction({ type: "role", user, role: option.role })
                    }
                    style={[
                      styles.roleChip,
                      user.role === option.role && styles.roleChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        user.role === option.role && styles.roleChipSelectedText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionRow}>
                <AppButton
                  label={user.active ? "Deactivate user" : "Activate user"}
                  onPress={() => setPendingAction({ type: "active", user })}
                  variant="secondary"
                />
                <AppButton
                  label="Send password reset"
                  onPress={() => setPendingAction({ type: "reset", user })}
                  variant="secondary"
                />
              </View>
            </View>
          ))}
        </View>

        {pendingAction ? (
          <View style={styles.confirmationBox}>
            <Text style={styles.confirmationTitle}>
              {getPendingActionTitle(pendingAction)}
            </Text>
            <Text style={styles.confirmationText}>
              {pendingAction.type === "role"
                ? `${pendingAction.user.displayName || pendingAction.user.email} will become ${formatRole(
                    pendingAction.role,
                  )}.`
                : pendingAction.type === "active"
                  ? `${pendingAction.user.displayName || pendingAction.user.email} will be ${
                      pendingAction.user.active ? "deactivated" : "activated"
                    }.`
                  : `Send a reset password email to ${pendingAction.user.email}.`}
            </Text>
            <View style={styles.actionRow}>
              <AppButton
                disabled={isSaving}
                label={isSaving ? "Saving..." : getPendingActionLabel(pendingAction)}
                onPress={() => {
                  if (pendingAction.type === "role") {
                    void handleRoleChange(pendingAction.user, pendingAction.role);
                  } else if (pendingAction.type === "active") {
                    void handleToggleActive(pendingAction.user);
                  } else {
                    void handleResetPassword(pendingAction.user);
                  }
                }}
              />
              <AppButton
                disabled={isSaving}
                label="Cancel"
                onPress={() => setPendingAction(null)}
                variant="secondary"
              />
            </View>
          </View>
        ) : null}
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
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  roleGrid: {
    gap: spacing.sm,
  },
  compactRoleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  roleChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roleChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  roleChipSelectedText: {
    color: colors.onPrimary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  searchPanel: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  filterSelectedText: {
    color: colors.onPrimary,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  recentUserCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  userHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  userTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  userName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  newPill: {
    backgroundColor: "#CCFBF1",
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  newPillText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  userMeta: {
    color: colors.muted,
    fontSize: 14,
  },
  roleLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  activePill: {
    backgroundColor: "#DCFCE7",
  },
  inactivePill: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  confirmationBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  confirmationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  confirmationText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  noticeText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
});
