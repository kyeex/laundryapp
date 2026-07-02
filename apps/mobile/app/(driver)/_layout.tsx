import { Stack } from "expo-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { roleStackScreenOptions } from "@/navigation/roleStackScreenOptions";

export default function DriverLayout() {
  return (
    <ProtectedRoute allowedRoles={["driver"]}>
      <Stack screenOptions={roleStackScreenOptions}>
        <Stack.Screen name="index" options={{ title: "Driver" }} />
        <Stack.Screen name="batches" options={{ title: "Assigned batches" }} />
        <Stack.Screen name="batches/[batchId]" options={{ title: "Batch stops" }} />
        <Stack.Screen
          name="batches/[batchId]/finalize"
          options={{ title: "Finalize route" }}
        />
      </Stack>
    </ProtectedRoute>
  );
}
