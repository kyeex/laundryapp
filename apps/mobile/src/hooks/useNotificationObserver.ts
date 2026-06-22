import { useEffect } from "react";

import { observeNotificationResponses } from "@/services/notificationService";

export function useNotificationObserver() {
  useEffect(() => observeNotificationResponses(), []);
}
