import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/context/AuthContext";
import { useNotificationObserver } from "@/hooks/useNotificationObserver";
import { StripeAppProvider } from "@/providers/StripeAppProvider";
import { colors } from "@/theme/colors";

export default function RootLayout() {
  useNotificationObserver();

  return (
    <StripeAppProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: "700",
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="index" options={{ title: "LaundryApp" }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(customer)" options={{ headerShown: false }} />
          <Stack.Screen name="(admin)" options={{ headerShown: false }} />
          <Stack.Screen name="(system-admin)" options={{ headerShown: false }} />
          <Stack.Screen name="(driver)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </StripeAppProvider>
  );
}
