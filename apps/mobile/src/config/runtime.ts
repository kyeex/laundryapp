export type AppEnvironment = "demo" | "staging" | "production";

function normalizeAppEnvironment(value: string | undefined): AppEnvironment {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === "production") {
    return "production";
  }

  if (normalizedValue === "staging" || normalizedValue === "preview") {
    return "staging";
  }

  return "demo";
}

export const appEnvironment = normalizeAppEnvironment(
  process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV,
);

export const isDemoEnvironment = appEnvironment === "demo";
export const requiresFirebaseBackend = !isDemoEnvironment;
