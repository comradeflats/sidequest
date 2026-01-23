import {
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();

// Custom error for popup blocked
export class PopupBlockedError extends Error {
  code = 'auth/popup-blocked';
  constructor() {
    super('Please allow popups for this site to sign in with Google, or try a different browser.');
    this.name = 'PopupBlockedError';
  }
}

// Sign in anonymously (frictionless onboarding)
export const signInAnonymous = async (): Promise<User> => {
  const result = await signInAnonymously(auth);
  return result.user;
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      throw new PopupBlockedError();
    }
    throw error;
  }
};

// Link anonymous account to Google (upgrade account)
export const linkAnonymousToGoogle = async (): Promise<User> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("No user signed in");
  }
  if (!currentUser.isAnonymous) {
    throw new Error("User is not anonymous");
  }
  try {
    const result = await linkWithPopup(currentUser, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      throw new PopupBlockedError();
    }
    throw error;
  }
};

// Sign out
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

// Auth state observer
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};
