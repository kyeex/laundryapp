import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { getFirebaseAuth } from "@/config/firebase";
import type { UserRole } from "@/types/domain";

import { createUserProfile, getUserProfile } from "./profileService";

type CreateAccountInput = {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  role: Extract<UserRole, "customer">;
};

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim(),
    password,
  );

  return getUserProfile(credential.user.uid);
}

export async function createAccount(input: CreateAccountInput) {
  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    input.email.trim(),
    input.password,
  );

  await updateProfile(credential.user, {
    displayName: input.displayName.trim(),
  });

  return createUserProfile({
    id: credential.user.uid,
    email: input.email.trim(),
    displayName: input.displayName.trim(),
    phone: input.phone.trim(),
    role: input.role,
  });
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export async function signOutCurrentUser() {
  await signOut(getFirebaseAuth());
}
