import { Stack } from "expo-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function SystemAdminLayout() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Admin panel" }} />
        <Stack.Screen name="audit-logs" options={{ title: "Audit logs" }} />
        <Stack.Screen name="demo-control" options={{ title: "Demo control center" }} />
        <Stack.Screen name="users" options={{ title: "User management" }} />
        <Stack.Screen name="permissions" options={{ title: "Permissions" }} />
      </Stack>
    </ProtectedRoute>
  );
}
