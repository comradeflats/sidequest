"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { User, updateProfile } from "firebase/auth";
import { onAuthChange, checkRedirectResult, signOut, signInWithGoogle } from "./auth";
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

    // Check for redirect result (handles mobile Google sign-in return)
    const handleRedirectResult = async () => {
      try {
        console.log('[FirebaseProvider] Checking redirect result...');
        const user = await checkRedirectResult();
        console.log('[FirebaseProvider] Redirect result:', user ? `User ${user.uid}` : 'No user');
      } catch (error: any) {
        console.error('[FirebaseProvider] Redirect error:', error.code, error.message);
        // Handle credential-already-in-use from redirect (Google account already linked)
        if (error.code === 'auth/credential-already-in-use') {
          console.log('[FirebaseProvider] Credential in use, signing out and retrying...');
          try {
            await signOut();
            await signInWithGoogle();
          } catch (e: any) {
            console.error('[FirebaseProvider] Failed to sign in after credential conflict:', e.code, e.message);
          }
        }
      }
    };
    handleRedirectResult();

    // Listen for auth state changes
    const unsubscribe = onAuthChange(async (authUser) => {
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

    return () => unsubscribe();
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
