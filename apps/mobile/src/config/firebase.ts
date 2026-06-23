import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

import {
  appEnvironment,
  isDemoEnvironment,
  requiresFirebaseBackend,
} from "@/config/runtime";

export const demoPreviewStorageKey = "laundryapp.demoPreview.enabled.v1";

function getLocalStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export const isDemoPreviewMode =
  !isDemoEnvironment && getLocalStorage()?.getItem(demoPreviewStorageKey) === "true";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);
export const shouldUseDemoBackend = isDemoEnvironment || isDemoPreviewMode;
export const canUseFirebaseBackend =
  requiresFirebaseBackend && isFirebaseConfigured && !isDemoPreviewMode;
export { appEnvironment, isDemoEnvironment, requiresFirebaseBackend };

let firebaseApp: FirebaseApp | null = null;

export function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    throw new Error(
      `${appEnvironment} mode requires Firebase. Add Firebase values to apps/mobile/.env.`,
    );
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
  }

  return firebaseApp;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseFirestore() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}

export function getFirebaseFunctions() {
  return getFunctions(getFirebaseApp());
}
