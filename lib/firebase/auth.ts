import {
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getRedirectResult,
  User,
} from "firebase/auth";
import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();

// Detect mobile device
const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

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

// Sign in with Google (uses redirect on mobile, popup on desktop)
export const signInWithGoogle = async (): Promise<User> => {
  if (isMobile()) {
    // Mobile: use redirect (more reliable, no popup issues)
    await signInWithRedirect(auth, googleProvider);
    // Won't return - page redirects. Result handled by checkRedirectResult
    return null as any;
  }

  // Desktop: try popup
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

  if (isMobile()) {
    // Mobile: use redirect (more reliable, no popup issues)
    await linkWithRedirect(currentUser, googleProvider);
    // Won't return - page redirects. Result handled by checkRedirectResult
    return null as any;
  }

  // Desktop: try popup
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

// Check for redirect result (call on app initialization for mobile auth)
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    console.error('Redirect result error:', error);
    // Re-throw credential-already-in-use so it can be handled
    if (error.code === 'auth/credential-already-in-use') {
      throw error;
    }
    return null;
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
