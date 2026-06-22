import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0F766E",
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (existingPermissions.status !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("EAS project id is required for Expo push tokens.");
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}

export function observeNotificationResponses() {
  function redirect(notification: Notifications.Notification) {
    const url = notification.request.content.data?.url;

    if (typeof url === "string") {
      router.push(url);
    }
  }

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response?.notification) {
      redirect(response.notification);
    }
  });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      redirect(response.notification);
    },
  );

  return () => subscription.remove();
}
