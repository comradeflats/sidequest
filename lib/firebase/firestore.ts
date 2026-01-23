import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";

// User profile stored in Firestore at /users/{uid}
export interface UserProfile {
  displayName: string;
  createdAt: Date | Timestamp;
  totalXP: number;
  level: number;
  questsCompleted: number;
  updatedAt?: Date | Timestamp;
}

// What we get back from Firestore (with Timestamps)
interface FirestoreUserProfile {
  displayName: string;
  createdAt: Timestamp;
  totalXP: number;
  level: number;
  questsCompleted: number;
  updatedAt?: Timestamp;
}

/**
 * Save or update a user profile in Firestore
 */
export async function saveUserProfile(
  uid: string,
  profile: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, "users", uid);

  try {
    const existingDoc = await getDoc(userRef);

    if (existingDoc.exists()) {
      // Update existing profile
      await updateDoc(userRef, {
        ...profile,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new profile with defaults
      await setDoc(userRef, {
        displayName: profile.displayName || "Anonymous Explorer",
        totalXP: profile.totalXP ?? 0,
        level: profile.level ?? 1,
        questsCompleted: profile.questsCompleted ?? 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error saving user profile:", error);
    throw error;
  }
}

/**
 * Get a user profile from Firestore
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);

  try {
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as FirestoreUserProfile;
      return {
        displayName: data.displayName,
        createdAt: data.createdAt?.toDate() || new Date(),
        totalXP: data.totalXP || 0,
        level: data.level || 1,
        questsCompleted: data.questsCompleted || 0,
        updatedAt: data.updatedAt?.toDate(),
      };
    }

    return null;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
}

/**
 * Update user display name in Firestore
 */
export async function updateDisplayName(
  uid: string,
  displayName: string
): Promise<void> {
  await saveUserProfile(uid, { displayName });
}

/**
 * Check if user has a profile in Firestore
 */
export async function hasUserProfile(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile !== null;
}

/**
 * Create initial profile for a new user
 */
export async function createInitialProfile(
  uid: string,
  displayName?: string
): Promise<void> {
  await saveUserProfile(uid, {
    displayName: displayName || "Anonymous Explorer",
    totalXP: 0,
    level: 1,
    questsCompleted: 0,
  });
}
