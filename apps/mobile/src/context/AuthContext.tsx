import { router } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  appEnvironment,
  canUseFirebaseBackend,
  demoPreviewStorageKey,
  isDemoEnvironment,
  isDemoPreviewMode,
  isFirebaseConfigured,
  shouldUseDemoBackend,
} from "@/config/firebase";
import { demoUsers } from "@/data/demoData";
import {
  createAccount,
  requestPasswordReset,
  signIn,
  signOutCurrentUser,
  subscribeToAuthState,
} from "@/services/authService";
import { createManagedUser } from "@/services/adminUserService";
import { getUserProfile } from "@/services/profileService";
import type { AppUser, UserRole } from "@/types/domain";
import { getHomeRouteForRole } from "@/utils/authRouting";

type AuthContextValue = {
  currentUser: AppUser | null;
  appEnvironment: typeof appEnvironment;
  isConfigured: boolean;
  isDemoMode: boolean;
  isDemoPreviewMode: boolean;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccountWithEmail: (input: {
    email: string;
    password: string;
    displayName: string;
    phone: string;
    role: Extract<UserRole, "customer">;
  }) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  startDemoSession: (role: "customer" | "owner" | "driver" | "admin") => void;
  stopDemoPreviewSession: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const demoRoleStorageKey = "laundryapp.demo.role.v1";
const demoCustomerProfileStorageKey = "laundryapp.demo.createdCustomer.v1";

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function getStoredDemoRole() {
  const storedRole = getStorage()?.getItem(demoRoleStorageKey);

  return storedRole === "customer" ||
    storedRole === "owner" ||
    storedRole === "driver" ||
    storedRole === "admin"
    ? storedRole
    : null;
}

function getStoredDemoCustomerProfile() {
  const storedProfile = getStorage()?.getItem(demoCustomerProfileStorageKey);

  if (!storedProfile) {
    return null;
  }

  try {
    const parsedProfile = JSON.parse(storedProfile) as AppUser;

    return parsedProfile.role === "customer" ? parsedProfile : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (shouldUseDemoBackend) {
      const storedRole = getStoredDemoRole();

      if (storedRole) {
        const storedCustomerProfile =
          storedRole === "customer" ? getStoredDemoCustomerProfile() : null;
        const profile = storedCustomerProfile ?? demoUsers[storedRole];
        setCurrentUser(profile);

        if (isDemoPreviewMode) {
          router.replace(getHomeRouteForRole(profile.role));
        }
      }

      setIsLoading(false);
      return undefined;
    }

    if (!isFirebaseConfigured) {
      setCurrentUser(null);
      setIsLoading(false);
      return undefined;
    }

    return subscribeToAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      const profile = await getUserProfile(firebaseUser.uid);
      setCurrentUser(profile);
      setIsLoading(false);
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!canUseFirebaseBackend) {
      throw new Error("Email sign-in is available in staging and production after Firebase is configured.");
    }

    const profile = await signIn(email, password);

    if (!profile) {
      throw new Error("No app profile was found for this account.");
    }

    setCurrentUser(profile);
    router.replace(getHomeRouteForRole(profile.role));
  }, []);

  const createAccountWithEmail = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      phone: string;
      role: Extract<UserRole, "customer">;
    }) => {
      if (isDemoEnvironment) {
        const profile = await createManagedUser({
          displayName: input.displayName,
          email: input.email,
          phone: input.phone,
          role: "customer",
        });

        getStorage()?.setItem(demoRoleStorageKey, "customer");
        getStorage()?.setItem(demoCustomerProfileStorageKey, JSON.stringify(profile));
        setCurrentUser(profile);
        router.replace(getHomeRouteForRole(profile.role));
        return;
      }

      if (!canUseFirebaseBackend) {
        throw new Error("Firebase must be configured before creating real accounts.");
      }

      const profile = await createAccount(input);

      if (!profile) {
        throw new Error("The account was created, but the profile was not saved.");
      }

      setCurrentUser(profile);
      router.replace(getHomeRouteForRole(profile.role));
    },
    [],
  );

  const sendResetEmail = useCallback(async (email: string) => {
    if (!canUseFirebaseBackend) {
      return;
    }

    await requestPasswordReset(email);
  }, []);

  const startDemoSession = useCallback((role: "customer" | "owner" | "driver" | "admin") => {
    const profile = demoUsers[role];
    getStorage()?.setItem(demoRoleStorageKey, role);
    getStorage()?.removeItem(demoCustomerProfileStorageKey);

    if (!isDemoEnvironment && !isDemoPreviewMode) {
      getStorage()?.setItem(demoPreviewStorageKey, "true");
      setCurrentUser(profile);

      if ("location" in globalThis) {
        globalThis.location.assign("/");
        return;
      }
    }

    setCurrentUser(profile);
    router.replace(getHomeRouteForRole(profile.role));
  }, []);

  const stopDemoPreviewSession = useCallback(() => {
    getStorage()?.removeItem(demoPreviewStorageKey);
    getStorage()?.removeItem(demoRoleStorageKey);
    getStorage()?.removeItem(demoCustomerProfileStorageKey);
    setCurrentUser(null);

    if ("location" in globalThis) {
      globalThis.location.assign("/");
      return;
    }

    router.replace("/(auth)/sign-in");
  }, []);

  const signOut = useCallback(async () => {
    if (canUseFirebaseBackend) {
      await signOutCurrentUser();
    } else {
      getStorage()?.removeItem(demoPreviewStorageKey);
      getStorage()?.removeItem(demoRoleStorageKey);
      getStorage()?.removeItem(demoCustomerProfileStorageKey);
    }
    setCurrentUser(null);
    router.replace("/(auth)/sign-in");
  }, []);

  const value = useMemo(
    () => ({
      appEnvironment,
      currentUser,
      isConfigured: canUseFirebaseBackend,
      isDemoMode: shouldUseDemoBackend,
      isDemoPreviewMode,
      isLoading,
      signInWithEmail,
      createAccountWithEmail,
      sendResetEmail,
      startDemoSession,
      stopDemoPreviewSession,
      signOut,
    }),
    [
      currentUser,
      isLoading,
      signInWithEmail,
      createAccountWithEmail,
      sendResetEmail,
      startDemoSession,
      stopDemoPreviewSession,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
