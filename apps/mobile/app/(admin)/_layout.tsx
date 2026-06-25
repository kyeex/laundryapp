import { Stack } from "expo-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Owner dashboard" }} />
        <Stack.Screen name="orders" options={{ title: "Orders" }} />
        <Stack.Screen name="orders/[orderId]" options={{ title: "Manage order" }} />
        <Stack.Screen name="driver-tracking" options={{ title: "Driver tracking" }} />
        <Stack.Screen name="batches" options={{ title: "Batches" }} />
        <Stack.Screen name="reports" options={{ title: "Reports" }} />
        <Stack.Screen
          name="recurring-orders"
          options={{ title: "Recurring orders" }}
        />
        <Stack.Screen name="configuration" options={{ title: "Configuration" }} />
      </Stack>
    </ProtectedRoute>
  );
}
