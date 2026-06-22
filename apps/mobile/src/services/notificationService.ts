export async function registerForPushNotifications(): Promise<string> {
  throw new Error("Push notifications are only available in the native mobile app.");
}

export function observeNotificationResponses() {
  return () => undefined;
}
