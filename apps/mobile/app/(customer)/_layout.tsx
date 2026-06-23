import { Stack } from "expo-router";

import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function CustomerLayout() {
  return (
    <ProtectedRoute allowedRoles={["customer"]}>
      <Stack>
        <Stack.Screen name="index" options={{ title: "Customer" }} />
        <Stack.Screen
          name="profile-summary"
          options={{ title: "Customer profile" }}
        />
        <Stack.Screen
          name="preferences"
          options={{ title: "Customer preferences" }}
        />
        <Stack.Screen name="new-order" options={{ title: "New order" }} />
        <Stack.Screen name="order-review" options={{ title: "Review order" }} />
        <Stack.Screen name="orders" options={{ title: "My orders" }} />
        <Stack.Screen name="orders/[orderId]" options={{ title: "Order detail" }} />
        <Stack.Screen name="orders/[orderId]/pay" options={{ title: "Pay order" }} />
        <Stack.Screen
          name="orders/[orderId]/track"
          options={{ title: "Track order" }}
        />
        <Stack.Screen name="my-orders" options={{ title: "My orders" }} />
        <Stack.Screen name="my-orders/[orderId]" options={{ title: "Order detail" }} />
        <Stack.Screen name="my-orders/[orderId]/pay" options={{ title: "Pay order" }} />
        <Stack.Screen
          name="my-orders/[orderId]/track"
          options={{ title: "Track order" }}
        />
      </Stack>
    </ProtectedRoute>
  );
}
