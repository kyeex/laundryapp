import { Stack } from "expo-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function AdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Owner dashboard" }} />
        <Stack.Screen name="demo-control" options={{ title: "Demo control center" }} />
        <Stack.Screen name="orders" options={{ title: "Orders" }} />
        <Stack.Screen name="orders/[orderId]" options={{ title: "Manage order" }} />
        <Stack.Screen name="driver-tracking" options={{ title: "Driver tracking" }} />
        <Stack.Screen name="batches" options={{ title: "Batches" }} />
        <Stack.Screen name="configuration" options={{ title: "Configuration" }} />
      </Stack>
    </ProtectedRoute>
  );
}
