import { Platform, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type RoleHomeVisualRole = "customer" | "owner" | "driver" | "admin";

const roleCopy = {
  customer: {
    accent: "#0F766E",
    background: "#ECFDF5",
    border: "#A7F3D0",
    caption: "Laundry pickup and delivery, from doorstep to done.",
    chips: ["Pickup", "Clean", "Deliver"],
    headline: "Laundry on the move",
    label: "Customer",
  },
  owner: {
    accent: "#1D4ED8",
    background: "#EFF6FF",
    border: "#93C5FD",
    caption: "Requests, batches, payments, and delivery status stay organized.",
    chips: ["Orders", "Batches", "Revenue"],
    headline: "Operations in motion",
    label: "Owner",
  },
  driver: {
    accent: "#B45309",
    background: "#FFFBEB",
    border: "#FCD34D",
    caption: "Stops are lined up clearly for pickup and delivery routes.",
    chips: ["Route", "Stops", "Submit"],
    headline: "Route ready",
    label: "Driver",
  },
  admin: {
    accent: "#6D28D9",
    background: "#F5F3FF",
    border: "#C4B5FD",
    caption: "Users, permissions, audit activity, and demo controls stay visible.",
    chips: ["Users", "Roles", "Audit"],
    headline: "Control center",
    label: "Admin",
  },
} satisfies Record<
  RoleHomeVisualRole,
  {
    accent: string;
    background: string;
    border: string;
    caption: string;
    chips: string[];
    headline: string;
    label: string;
  }
>;

export function RoleHomeVisual({ role }: { role: RoleHomeVisualRole }) {
  const copy = roleCopy[role];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: copy.background,
          borderColor: copy.border,
        },
      ]}
    >
      <View style={[styles.accentRail, { backgroundColor: copy.accent }]} />
      <View style={styles.copy}>
        <Text style={[styles.badge, { backgroundColor: copy.accent }]}>{copy.label}</Text>
        <Text style={styles.headline}>{copy.headline}</Text>
        <Text style={styles.caption}>{copy.caption}</Text>
        <View style={styles.chips}>
          {copy.chips.map((chip) => (
            <Text key={chip} style={[styles.chip, { borderColor: copy.border }]}>
              {chip}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.scene} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.sun, { backgroundColor: `${copy.accent}22` }]} />
        <View style={styles.cloudLarge} />
        <View style={styles.cloudSmall} />
        <View style={[styles.routeLine, { backgroundColor: copy.accent }]} />
        <View style={styles.routeDotStart} />
        <View style={[styles.routeDotEnd, { backgroundColor: copy.accent }]} />

        <View style={styles.truckWrap}>
          <View style={[styles.truckBox, { borderColor: copy.accent }]}>
            <View style={[styles.truckLogo, { backgroundColor: copy.accent }]} />
            <View style={styles.foldedLaundry} />
          </View>
          <View style={[styles.truckCab, { backgroundColor: copy.accent }]}>
            <View style={styles.truckWindow} />
          </View>
          <View style={styles.truckBase} />
          <View style={styles.wheelLeft} />
          <View style={styles.wheelRight} />
        </View>

        <View style={[styles.roleIcon, { borderColor: copy.accent }]}>
          {role === "driver" ? (
            <RouteIcon accent={copy.accent} />
          ) : role === "owner" ? (
            <OrderIcon accent={copy.accent} />
          ) : role === "admin" ? (
            <AdminIcon accent={copy.accent} />
          ) : (
            <LaundryIcon accent={copy.accent} />
          )}
        </View>
      </View>
    </View>
  );
}

function LaundryIcon({ accent }: { accent: string }) {
  return (
    <View style={styles.washer}>
      <View style={[styles.washerDoor, { borderColor: accent }]}>
        <View style={[styles.washerBubble, { backgroundColor: `${accent}33` }]} />
      </View>
      <View style={[styles.washerButton, { backgroundColor: accent }]} />
    </View>
  );
}

function OrderIcon({ accent }: { accent: string }) {
  return (
    <View style={styles.orderStack}>
      <View style={[styles.orderLine, { backgroundColor: accent }]} />
      <View style={styles.orderLineMuted} />
      <View style={styles.orderLineMuted} />
    </View>
  );
}

function RouteIcon({ accent }: { accent: string }) {
  return (
    <View style={styles.routeMini}>
      <View style={[styles.routeMiniDot, { backgroundColor: accent }]} />
      <View style={[styles.routeMiniBar, { backgroundColor: accent }]} />
      <View style={[styles.routeMiniDot, { backgroundColor: accent }]} />
    </View>
  );
}

function AdminIcon({ accent }: { accent: string }) {
  return (
    <View style={styles.adminGrid}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={[styles.adminCell, { borderColor: accent }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: Platform.select({
      default: "column",
      web: "row",
    }),
    gap: spacing.md,
    overflow: "hidden",
    padding: Platform.select({
      default: spacing.lg,
      web: spacing.md,
    }),
    shadowColor: "#0F172A",
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: Platform.select({
      default: 0.08,
      web: 0,
    }),
    shadowRadius: 10,
    elevation: Platform.select({
      default: 2,
      web: 0,
    }),
  },
  accentRail: {
    borderRadius: 999,
    height: 5,
    left: spacing.lg,
    opacity: 0.9,
    position: "absolute",
    right: spacing.lg,
    top: spacing.md,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    color: colors.onPrimary,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  headline: {
    color: colors.text,
    fontSize: Platform.select({
      default: 24,
      web: 24,
    }),
    fontWeight: "900",
    lineHeight: Platform.select({
      default: 30,
      web: 30,
    }),
  },
  caption: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scene: {
    alignSelf: "stretch",
    backgroundColor: "#FFFFFFAA",
    borderColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    height: Platform.select({
      default: 190,
      web: 180,
    }),
    minWidth: Platform.select({
      default: undefined,
      web: 330,
    }),
    overflow: "hidden",
  },
  sun: {
    borderRadius: 999,
    height: 86,
    position: "absolute",
    right: -18,
    top: -26,
    width: 86,
  },
  cloudLarge: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    left: 22,
    position: "absolute",
    top: 22,
    width: 76,
  },
  cloudSmall: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    left: 72,
    position: "absolute",
    top: 44,
    width: 52,
  },
  routeLine: {
    borderRadius: 999,
    bottom: 34,
    height: 6,
    left: 28,
    opacity: 0.28,
    position: "absolute",
    right: 28,
  },
  routeDotStart: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 3,
    bottom: 26,
    height: 22,
    left: 26,
    position: "absolute",
    width: 22,
  },
  routeDotEnd: {
    borderColor: colors.surface,
    borderRadius: 999,
    borderWidth: 3,
    bottom: 24,
    height: 26,
    position: "absolute",
    right: 25,
    width: 26,
  },
  truckWrap: {
    bottom: 38,
    height: 82,
    left: 42,
    position: "absolute",
    width: 176,
  },
  truckBox: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    height: 58,
    left: 0,
    position: "absolute",
    top: 9,
    width: 105,
  },
  truckLogo: {
    borderRadius: 999,
    height: 14,
    left: 12,
    position: "absolute",
    top: 12,
    width: 14,
  },
  foldedLaundry: {
    backgroundColor: "#E0F2FE",
    borderColor: "#BAE6FD",
    borderRadius: 5,
    borderWidth: 1,
    bottom: 10,
    height: 18,
    left: 42,
    position: "absolute",
    width: 42,
  },
  truckCab: {
    borderBottomRightRadius: 8,
    borderTopRightRadius: 12,
    height: 46,
    left: 99,
    position: "absolute",
    top: 21,
    width: 58,
  },
  truckWindow: {
    backgroundColor: "#DBEAFE",
    borderRadius: 5,
    height: 20,
    position: "absolute",
    right: 9,
    top: 8,
    width: 25,
  },
  truckBase: {
    backgroundColor: "#334155",
    borderRadius: 999,
    bottom: 12,
    height: 7,
    left: 8,
    position: "absolute",
    width: 154,
  },
  wheelLeft: {
    backgroundColor: "#111827",
    borderColor: "#F8FAFC",
    borderRadius: 999,
    borderWidth: 4,
    bottom: 0,
    height: 28,
    left: 28,
    position: "absolute",
    width: 28,
  },
  wheelRight: {
    backgroundColor: "#111827",
    borderColor: "#F8FAFC",
    borderRadius: 999,
    borderWidth: 4,
    bottom: 0,
    height: 28,
    left: 124,
    position: "absolute",
    width: 28,
  },
  roleIcon: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    position: "absolute",
    right: 18,
    top: 82,
    width: 64,
  },
  washer: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    width: 34,
  },
  washerDoor: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    left: 6,
    position: "absolute",
    top: 13,
    width: 22,
  },
  washerBubble: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  washerButton: {
    borderRadius: 999,
    height: 5,
    position: "absolute",
    right: 6,
    top: 5,
    width: 5,
  },
  orderStack: {
    gap: spacing.xs,
    width: 36,
  },
  orderLine: {
    borderRadius: 999,
    height: 7,
    width: 36,
  },
  orderLineMuted: {
    backgroundColor: "#CBD5E1",
    borderRadius: 999,
    height: 7,
    width: 28,
  },
  routeMini: {
    alignItems: "center",
    gap: spacing.xs,
  },
  routeMiniDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  routeMiniBar: {
    borderRadius: 999,
    height: 22,
    opacity: 0.4,
    width: 5,
  },
  adminGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    width: 34,
  },
  adminCell: {
    backgroundColor: "#F8FAFC",
    borderRadius: 5,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
});
