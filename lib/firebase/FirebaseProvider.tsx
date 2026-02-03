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

