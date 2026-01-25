// Firebase config and services (minimal - for Analytics only)
export { default as app, initAnalytics } from "./config";

// Provider and hook (minimal - auth removed)
export { FirebaseProvider, useFirebase } from "./FirebaseProvider";
