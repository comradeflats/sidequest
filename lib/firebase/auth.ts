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
  setPersistence,
  browserLocalPersistence,
  User,
} from "firebase/auth";
import { auth } from "./config";
import {
  authLog,
  logAuthEvent,
  logAuthError,
  markRedirectStarted,
  clearRedirectState,
  getDeviceInfo,
  getNetworkState,
} from "../auth-debug";

const googleProvider = new GoogleAuthProvider();

// Redirect tracking - used to detect when returning from Google sign-in redirect
const REDIRECT_PENDING_KEY = 'firebase_auth_redirect_pending';

export const setRedirectPending = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REDIRECT_PENDING_KEY, 'true');
    markRedirectStarted();
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
    clearRedirectState();
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
  logAuthEvent('anonymous_sign_in_started');
  try {
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInAnonymously(auth);
    logAuthEvent('anonymous_sign_in_success', { uid: result.user.uid });
    return result.user;
  } catch (error: any) {
    logAuthEvent('anonymous_sign_in_error', { code: error.code, message: error.message });
    throw error;
  }
};

// Sign in with Google (popup-first strategy to avoid cross-origin redirect issues)
export const signInWithGoogle = async (): Promise<User> => {
  const deviceInfo = getDeviceInfo();
  const networkState = getNetworkState();

  logAuthEvent('google_sign_in_started', {
    isMobile: deviceInfo.isMobile,
    platform: deviceInfo.isIOS ? 'iOS' : deviceInfo.isAndroid ? 'Android' : 'other',
    browser: deviceInfo.isSafari ? 'Safari' : deviceInfo.isChrome ? 'Chrome' : 'other',
    online: networkState.online,
  });

  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    logAuthError('set_persistence', error);
  }

  // Try popup first for ALL devices (avoids cross-origin redirect issues)
  authLog('Attempting popup sign-in (popup-first strategy)');
  try {
    const result = await signInWithPopup(auth, googleProvider);
    logAuthEvent('popup_sign_in_success', { uid: result.user.uid });
    return result.user;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    logAuthError('signInWithGoogle_popup', error);

    // If popup blocked/closed and on mobile, fall back to redirect
    if (isMobile() && (
      firebaseError.code === 'auth/popup-blocked' ||
      firebaseError.code === 'auth/popup-closed-by-user' ||
      firebaseError.code === 'auth/cancelled-popup-request'
    )) {
      authLog('Popup failed on mobile, falling back to redirect');
      setRedirectPending();
      await signInWithRedirect(auth, googleProvider);
      return null as any;
    }

    // Desktop popup blocked - throw user-friendly error
    if (firebaseError.code === 'auth/popup-blocked' ||
        firebaseError.code === 'auth/popup-closed-by-user') {
      throw new PopupBlockedError();
    }

    throw error;
  }
};

// Link anonymous account to Google (popup-first strategy to avoid cross-origin redirect issues)
export const linkAnonymousToGoogle = async (): Promise<User> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    logAuthEvent('link_error', { reason: 'no_user' });
    throw new Error("No user signed in");
  }
  if (!currentUser.isAnonymous) {
    logAuthEvent('link_error', { reason: 'not_anonymous' });
    throw new Error("User is not anonymous");
  }

  logAuthEvent('link_anonymous_started', { uid: currentUser.uid });

  // Try popup first for ALL devices (avoids cross-origin redirect issues)
  authLog('Attempting link popup (popup-first strategy)');
  try {
    const result = await linkWithPopup(currentUser, googleProvider);
    logAuthEvent('link_popup_success', { uid: result.user.uid });
    return result.user;
  } catch (error: unknown) {
    const firebaseError = error as { code?: string };
    logAuthError('linkAnonymousToGoogle_popup', error);

    // If popup blocked/closed and on mobile, fall back to redirect
    if (isMobile() && (
      firebaseError.code === 'auth/popup-blocked' ||
      firebaseError.code === 'auth/popup-closed-by-user' ||
      firebaseError.code === 'auth/cancelled-popup-request'
    )) {
      authLog('Link popup failed on mobile, falling back to redirect');
      setRedirectPending();
      await linkWithRedirect(currentUser, googleProvider);
      return null as any;
    }

    // Desktop popup blocked - throw user-friendly error
    if (firebaseError.code === 'auth/popup-blocked' ||
        firebaseError.code === 'auth/popup-closed-by-user') {
      throw new PopupBlockedError();
    }

    throw error;
  }
};

// Check for redirect result (call on app initialization for mobile auth)
export const checkRedirectResult = async (): Promise<User | null> => {
  try {
    authLog('checkRedirectResult called', {
      currentUser: auth.currentUser?.uid || 'none',
      isAnonymous: auth.currentUser?.isAnonymous,
    });

    const result = await getRedirectResult(auth);

    logAuthEvent('redirect_result', {
      hasResult: !!result,
      userId: result?.user?.uid,
      email: result?.user?.email,
      operationType: result?.operationType,
      providerId: result?.providerId,
    });

    return result?.user || null;
  } catch (error: unknown) {
    logAuthError('checkRedirectResult', error);
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
