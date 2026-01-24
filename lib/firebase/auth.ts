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

// Redirect tracking - used to detect when returning from Google sign-in redirect
const REDIRECT_PENDING_KEY = 'firebase_auth_redirect_pending';

export const setRedirectPending = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REDIRECT_PENDING_KEY, 'true');
  }
};

export const isRedirectPending = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REDIRECT_PENDING_KEY) === 'true';
  }
  return false;
};

export const clearRedirectPending = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(REDIRECT_PENDING_KEY);
  }
};

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
  console.log('[Auth] signInWithGoogle - isMobile:', isMobile());

  if (isMobile()) {
    // Mobile: use redirect (more reliable, no popup issues)
    console.log('[Auth] Setting redirect pending flag');
    setRedirectPending();
    console.log('[Auth] Calling signInWithRedirect...');
    await signInWithRedirect(auth, googleProvider);
    // Won't return - page redirects. Result handled by checkRedirectResult
    return null as any;
  }

  // Desktop: try popup
  console.log('[Auth] Using popup flow for desktop');
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log('[Auth] Popup sign-in successful:', result.user.uid);
    return result.user;
  } catch (error: any) {
    console.error('[Auth] Popup sign-in error:', error.code, error.message);
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
    setRedirectPending();
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
    console.log('[Auth] checkRedirectResult - auth.currentUser:', auth.currentUser?.uid);
    console.log('[Auth] Calling getRedirectResult...');
    const result = await getRedirectResult(auth);
    console.log('[Auth] Result details:', {
      hasResult: !!result,
      userId: result?.user?.uid,
      email: result?.user?.email,
      operationType: result?.operationType
    });
    return result?.user || null;
  } catch (error: any) {
    console.error('[Auth] getRedirectResult error:', error.code, error.message, error);
    // Re-throw all errors so they can be handled by the caller
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
