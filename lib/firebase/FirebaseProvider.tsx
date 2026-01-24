"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, updateProfile } from "firebase/auth";
import { onAuthChange, checkRedirectResult, signOut, signInWithGoogle, isRedirectPending, clearRedirectPending } from "./auth";
import { initAnalytics } from "./config";
import { getUserProfile, saveUserProfile, UserProfile } from "./firestore";

export type StorageMode = 'local' | 'cloud';
export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  // New fields for auth UX
  displayName: string | null;
  storageMode: StorageMode;
  syncStatus: SyncStatus;
  needsProfileSetup: boolean;
  // Actions
  updateUserDisplayName: (name: string) => Promise<void>;
  completeProfileSetup: () => void;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  displayName: null,
  storageMode: 'local',
  syncStatus: 'offline',
  needsProfileSetup: false,
  updateUserDisplayName: async () => {},
  completeProfileSetup: () => {},
});

export const useFirebase = () => useContext(FirebaseContext);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  // Update display name in both Firebase Auth and Firestore
  const updateUserDisplayName = useCallback(async (name: string) => {
    if (!user) return;

    try {
      setSyncStatus('syncing');

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: name });

      // Update Firestore profile
      await saveUserProfile(user.uid, { displayName: name });

      setDisplayName(name);
      setSyncStatus('synced');
    } catch (error) {
      console.error('Failed to update display name:', error);
      setSyncStatus('error');
      throw error;
    }
  }, [user]);

  // Mark profile setup as complete
  const completeProfileSetup = useCallback(() => {
    setNeedsProfileSetup(false);
  }, []);

  useEffect(() => {
    // Initialize analytics
    initAnalytics();

    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      // Log initial state for debugging
      console.log('[FirebaseProvider] initAuth - isRedirectPending:', isRedirectPending());
      console.log('[FirebaseProvider] localStorage redirect flag:', typeof window !== 'undefined' ? localStorage.getItem('firebase_auth_redirect_pending') : 'N/A');
      console.log('[FirebaseProvider] Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');

      // Check for pending redirect FIRST (mobile Google sign-in return)
      // This MUST complete before setting up the auth listener to avoid race condition
      if (isRedirectPending()) {
        console.log('[FirebaseProvider] Redirect pending, checking result...');
        try {
          const redirectUser = await checkRedirectResult();
          console.log('[FirebaseProvider] Redirect result:', redirectUser ? `User ${redirectUser.uid} (anon: ${redirectUser.isAnonymous})` : 'No user');
        } catch (error: any) {
          console.error('[FirebaseProvider] Redirect error:', error.code, error.message);
          // Handle credential-already-in-use from redirect (Google account already linked)
          if (error.code === 'auth/credential-already-in-use') {
            console.log('[FirebaseProvider] Credential in use, signing out and retrying...');
            try {
              await signOut();
              await signInWithGoogle();
              return; // Will redirect again, don't set up listener yet
            } catch (e: any) {
              console.error('[FirebaseProvider] Failed to sign in after credential conflict:', e.code, e.message);
            }
          }
        } finally {
          clearRedirectPending();
        }
      } else {
        // IMPORTANT FIX: Also check getRedirectResult even when flag is not set
        // The localStorage flag may be lost if the page reloads differently
        console.log('[FirebaseProvider] No redirect flag - checking anyway...');
        try {
          const unexpectedResult = await checkRedirectResult();
          if (unexpectedResult) {
            console.log('[FirebaseProvider] FOUND redirect result without flag!', unexpectedResult.uid);
          } else {
            console.log('[FirebaseProvider] No redirect result found (expected)');
          }
        } catch (e: any) {
          // Expected - no redirect result or error
          console.log('[FirebaseProvider] checkRedirectResult without flag - error:', e.code || e.message);
        }
      }

      // NOW set up auth state listener (redirect is already handled)
      unsubscribe = onAuthChange(async (authUser) => {
        console.log('[FirebaseProvider] Auth state changed:', authUser ? `User ${authUser.uid} (anon: ${authUser.isAnonymous})` : 'No user');
        setUser(authUser);

        if (authUser) {
          // User is signed in - cloud mode
          setStorageMode('cloud');
          setSyncStatus('syncing');

          try {
            // Try to get existing profile from Firestore
            const profile = await getUserProfile(authUser.uid);

            if (profile) {
              // Existing user with profile
              setDisplayName(profile.displayName);
              setNeedsProfileSetup(false);
            } else {
              // New user - show profile setup modal
              // Pre-fill with Google name if available, but let them customize
              setDisplayName(authUser.displayName || null);
              setNeedsProfileSetup(true);
            }

            setSyncStatus('synced');
          } catch (error) {
            console.error('Error loading user profile:', error);
            // Fall back to Auth display name if Firestore fails
            setDisplayName(authUser.displayName);
            setSyncStatus('error');
          }
        } else {
          // User signed out - back to local mode
          setStorageMode('local');
          setSyncStatus('offline');
          setDisplayName(null);
          setNeedsProfileSetup(false);
        }

        setLoading(false);
      });
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        displayName,
        storageMode,
        syncStatus,
        needsProfileSetup,
        updateUserDisplayName,
        completeProfileSetup,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
}
