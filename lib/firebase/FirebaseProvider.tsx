"use client";

import { useEffect, ReactNode } from "react";
import { initAnalytics } from "./config";

/**
 * Minimal Firebase Provider - only initializes Analytics
 * Auth has been removed for local-only storage simplicity
 */
export function FirebaseProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Initialize analytics
    initAnalytics();
  }, []);

  return <>{children}</>;
}

/**
 * Hook for Firebase context - returns empty/default values
 * Kept for backwards compatibility with components that may still import it
 */
export const useFirebase = () => ({
  user: null,
  loading: false,
  isAuthenticated: false,
  displayName: null,
  storageMode: 'local' as const,
  syncStatus: 'offline' as const,
  needsProfileSetup: false,
  updateUserDisplayName: async () => {},
  completeProfileSetup: () => {},
});
