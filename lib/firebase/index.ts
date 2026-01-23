// Firebase config and services
export { default as app, auth, db, storage, initAnalytics } from "./config";

// Auth helpers
export {
  signInAnonymous,
  signInWithGoogle,
  linkAnonymousToGoogle,
  signOut,
  onAuthChange,
  getCurrentUser,
  PopupBlockedError,
} from "./auth";

// Provider and hook
export { FirebaseProvider, useFirebase } from "./FirebaseProvider";
export type { StorageMode, SyncStatus } from "./FirebaseProvider";

// Firestore helpers
export {
  saveUserProfile,
  getUserProfile,
  updateDisplayName,
  hasUserProfile,
  createInitialProfile,
} from "./firestore";
export type { UserProfile } from "./firestore";
