import type { Href } from "expo-router";

import type { UserRole } from "@/types/domain";

export function getHomeRouteForRole(role: UserRole): Href {
  if (role === "admin") {
    return "/(system-admin)";
  }

  if (role === "owner") {
    return "/(admin)";
  }

  if (role === "driver") {
    return "/(driver)";
  }

  return "/(customer)";
}
