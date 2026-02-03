import { Campaign, VerificationResult, JourneyStats, StoredCampaign, PlayerProgress, LEVEL_THRESHOLDS, VisitedPlace, VisitedPlacesData, Coordinates } from '../types';
import {
  saveCampaignImages,
  loadCampaignImages,
  deleteImagesForCampaign,
  isIndexedDBAvailable,
} from './indexeddb-storage';

// Storage keys
const CURRENT_CAMPAIGN_KEY = 'current_campaign_id';
const CAMPAIGN_HISTORY_KEY = 'campaign_history';
const PLAYER_PROGRESS_KEY = 'player_progress';
const QUEST_PREFERENCES_KEY = 'quest_preferences';
const VISITED_PLACES_KEY = 'visited_places';
const STREAK_DATA_KEY = 'streak_data';
const USER_PROFILE_KEY = 'user_profile';
const MAX_HISTORY_SIZE = 10;
const MAX_VISITED_PLACES = 500;

// Visited place configuration for tiered penalty system
export const VISITED_PLACE_CONFIG = {
  HARD_EXCLUSION_DAYS: 7,
  HARD_EXCLUSION_CAMPAIGNS: 3,
  MEDIUM_PENALTY_DAYS: 30,
  LIGHT_PENALTY_DAYS: 90,
  MIN_UNVISITED_RATIO: 0.5,
  MAX_CAMPAIGN_HISTORY: 10
} as const;

// Streak tracking data
export interface StreakData {
  lastPlayDate: string; // YYYY-MM-DD format
  consecutiveDays: number;
}

// User profile data
export interface UserProfile {
  username: string;
  avatarId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Avatar options with Lucide icons
export const AVATAR_OPTIONS = [
  { id: 'compass', icon: 'Compass', label: 'Explorer', color: 'text-adventure-gold' },
  { id: 'map', icon: 'Map', label: 'Cartographer', color: 'text-adventure-emerald' },
  { id: 'mountain', icon: 'Mountain', label: 'Climber', color: 'text-adventure-sky' },
  { id: 'tent', icon: 'Tent', label: 'Camper', color: 'text-green-500' },
  { id: 'gem', icon: 'Gem', label: 'Treasure Hunter', color: 'text-purple-500' },
  { id: 'flame', icon: 'Flame', label: 'Trailblazer', color: 'text-orange-500' },
  { id: 'star', icon: 'Star', label: 'Star Seeker', color: 'text-yellow-400' },
  { id: 'trophy', icon: 'Trophy', label: 'Champion', color: 'text-amber-500' },
  { id: 'swords', icon: 'Swords', label: 'Knight', color: 'text-slate-400' },
  { id: 'crown', icon: 'Crown', label: 'Royalty', color: 'text-yellow-500' },
  { id: 'ship', icon: 'Ship', label: 'Voyager', color: 'text-blue-400' },
  { id: 'bird', icon: 'Bird', label: 'Scout', color: 'text-sky-400' },
] as const;

export type AvatarOption = typeof AVATAR_OPTIONS[number];

// Quest type preferences
export interface QuestTypePreferences {
  enableVideoQuests: boolean;
  enableAudioQuests: boolean;
  guaranteedMix: boolean;
}

/**
 * Save a campaign to storage (IndexedDB for images, localStorage for metadata)
 */
export async function saveCampaign(
  campaign: Campaign,
  progress: {
    currentQuestIndex: number;
    completedQuests: string[];
    verificationResults?: Record<string, VerificationResult>;
  },
  journeyStats?: JourneyStats
): Promise<void> {
  // Save images to IndexedDB (if available)
  if (isIndexedDBAvailable()) {
    try {
      await saveCampaignImages(campaign.id, campaign.quests);
    } catch {
      // IndexedDB save failed, images will be regenerated on next load
    }
  }

  // Save metadata to localStorage (without images)
  try {
    const campaignWithoutImages = {
      ...campaign,
      quests: campaign.quests.map(quest => ({
        ...quest,
        imageUrl: undefined
      }))
    };

    const stored: StoredCampaign = {
      campaign: campaignWithoutImages,
      completedAt: null,
      lastPlayedAt: new Date(),
      progress: {
        currentQuestIndex: progress.currentQuestIndex,
        completedQuests: progress.completedQuests,
        verificationResults: progress.verificationResults || {}
      },
      journeyStats
    };

    localStorage.setItem(`campaign_${campaign.id}`, JSON.stringify(stored));
    localStorage.setItem(CURRENT_CAMPAIGN_KEY, campaign.id);
  } catch {
    // Failed to save campaign to localStorage
  }
}

/**
 * Load a campaign from storage (metadata from localStorage, images from IndexedDB)
 */
export async function loadCampaign(campaignId: string): Promise<StoredCampaign | null> {
  let stored: StoredCampaign | null = null;

  // Load from localStorage
  try {
    const data = localStorage.getItem(`campaign_${campaignId}`);
    if (!data) {
      return null;
    }

    stored = JSON.parse(data);

    // Parse dates
    if (stored) {
      stored.lastPlayedAt = new Date(stored.lastPlayedAt);
      if (stored.completedAt) {
        stored.completedAt = new Date(stored.completedAt);
      }
      if (stored.journeyStats) {
        stored.journeyStats.startTime = new Date(stored.journeyStats.startTime);
        if (stored.journeyStats.endTime) {
          stored.journeyStats.endTime = new Date(stored.journeyStats.endTime);
        }
        stored.journeyStats.pathPoints = stored.journeyStats.pathPoints.map(point => ({
          ...point,
          timestamp: new Date(point.timestamp)
        }));
        stored.journeyStats.questCompletionTimes = stored.journeyStats.questCompletionTimes.map(
          time => new Date(time)
        );
      }
    }
  } catch {
    return null;
  }

  if (!stored) {
    return null;
  }

  // Load images from IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      const questIds = stored.campaign.quests.map(q => q.id);
      const images = await loadCampaignImages(campaignId, questIds);

      // Attach images to quests
      for (const quest of stored.campaign.quests) {
        if (images[quest.id]) {
          quest.imageUrl = images[quest.id];
        }
      }
    } catch {
      // Failed to load images from IndexedDB, they will be regenerated
    }
  }

  return stored;
}

/**
 * Get the current active campaign ID
 */
export async function getCurrentCampaignId(): Promise<string | null> {
  return localStorage.getItem(CURRENT_CAMPAIGN_KEY);
}

/**
 * Clear the current campaign (user finished or abandoned)
 */
export async function clearCurrentCampaign(): Promise<void> {
  localStorage.removeItem(CURRENT_CAMPAIGN_KEY);
}

/**
 * Mark a campaign as completed
 */
export async function markCampaignComplete(campaignId: string): Promise<void> {
  try {
    const data = localStorage.getItem(`campaign_${campaignId}`);
    if (data) {
      const stored: StoredCampaign = JSON.parse(data);
      stored.completedAt = new Date();
      localStorage.setItem(`campaign_${campaignId}`, JSON.stringify(stored));
    }
  } catch {
    // Failed to mark campaign complete
  }
}

/**
 * Add a campaign to history
 */
export async function addToHistory(campaignId: string): Promise<void> {
  try {
    const historyData = localStorage.getItem(CAMPAIGN_HISTORY_KEY);
    let history: string[] = historyData ? JSON.parse(historyData) : [];

    // Add to beginning (newest first)
    history = [campaignId, ...history.filter(id => id !== campaignId)];

    // Limit to MAX_HISTORY_SIZE
    if (history.length > MAX_HISTORY_SIZE) {
      const removed = history.slice(MAX_HISTORY_SIZE);
      // Delete old campaigns
      removed.forEach(id => deleteCampaign(id));
      history = history.slice(0, MAX_HISTORY_SIZE);
    }

    localStorage.setItem(CAMPAIGN_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Failed to add to history
  }
}

/**
 * Get campaign history (array of StoredCampaign objects)
 */
export async function getCampaignHistory(): Promise<StoredCampaign[]> {
  try {
    const historyData = localStorage.getItem(CAMPAIGN_HISTORY_KEY);
    if (!historyData) return [];

    const history: string[] = JSON.parse(historyData);
    const campaigns: StoredCampaign[] = [];

    for (const campaignId of history) {
      const campaign = await loadCampaign(campaignId);
      if (campaign) {
        campaigns.push(campaign);
      }
    }

    return campaigns;
  } catch {
    return [];
  }
}

/**
 * Delete a campaign from storage
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  // Delete images from IndexedDB
  if (isIndexedDBAvailable()) {
    try {
      await deleteImagesForCampaign(campaignId);
    } catch {
      // Failed to delete images from IndexedDB
    }
  }

  // Delete from localStorage
  try {
    localStorage.removeItem(`campaign_${campaignId}`);
    localStorage.removeItem(`journey_${campaignId}`);
  } catch {
    // Failed to delete campaign
  }
}

/**
 * Get storage size estimate (for debugging)
 */
export function getStorageSize(): { totalBytes: number; totalKB: number; totalMB: number } {
  let totalBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key);
      if (value) {
        totalBytes += key.length + value.length;
      }
    }
  }

  return {
    totalBytes,
    totalKB: Math.round(totalBytes / 1024 * 100) / 100,
    totalMB: Math.round(totalBytes / (1024 * 1024) * 100) / 100
  };
}

/**
 * Clear all SideQuest data from localStorage (for debugging/reset)
 */
export function clearAllData(): void {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('campaign_') ||
        key.startsWith('journey_') ||
        key === CURRENT_CAMPAIGN_KEY ||
        key === CAMPAIGN_HISTORY_KEY
      )) {
        keys.push(key);
      }
    }

    keys.forEach(key => localStorage.removeItem(key));
  } catch {
    // Failed to clear all data
  }
}

/**
 * Calculate level from total XP
 */
export function calculateLevel(xp: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, LEVEL_THRESHOLDS.length);
}

/**
 * Get player progress from localStorage
 */
export function getPlayerProgress(): PlayerProgress {
  try {
    const data = localStorage.getItem(PLAYER_PROGRESS_KEY);
    if (data) {
      const progress: PlayerProgress = JSON.parse(data);
      // Recalculate level in case thresholds changed
      progress.level = calculateLevel(progress.totalXP);
      return progress;
    }
  } catch {
    // Failed to load player progress
  }

  // Default progress
  return {
    totalXP: 0,
    level: 1,
    questsCompleted: 0
  };
}

/**
 * Add XP to player progress
 */
export async function addXP(amount: number): Promise<PlayerProgress> {
  const current = getPlayerProgress();

  current.totalXP += amount;
  current.questsCompleted += 1;
  current.level = calculateLevel(current.totalXP);

  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(current));
  } catch {
    // Failed to save player progress
  }

  return current;
}

/**
 * Set player XP to a specific value (for rollback on campaign quit)
 */
export async function setPlayerXP(targetXP: number): Promise<PlayerProgress> {
  const current = getPlayerProgress();

  // Calculate the difference
  const xpDifference = current.totalXP - targetXP;
  const questsDifference = Math.max(0, Math.floor(xpDifference / 100));

  current.totalXP = Math.max(0, targetXP); // Don't go negative
  current.questsCompleted = Math.max(0, current.questsCompleted - questsDifference);
  current.level = calculateLevel(current.totalXP);

  try {
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(current));
  } catch {
    // Failed to save player progress
  }

  return current;
}

/**
 * Get XP needed for next level
 */
export function getXPForNextLevel(currentXP: number): { current: number; needed: number; progress: number } {
  const level = calculateLevel(currentXP);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

  const xpInCurrentLevel = currentXP - currentThreshold;
  const xpNeededForLevel = nextThreshold - currentThreshold;
  const progress = xpNeededForLevel > 0 ? (xpInCurrentLevel / xpNeededForLevel) * 100 : 100;

  return {
    current: xpInCurrentLevel,
    needed: xpNeededForLevel,
    progress: Math.min(progress, 100)
  };
}

// ============================================
// Quest Type Preferences
// ============================================

/**
 * Get quest type preferences from storage
 */
export function getQuestTypePreferences(): QuestTypePreferences {
  try {
    const data = localStorage.getItem(QUEST_PREFERENCES_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Failed to load quest type preferences
  }

  // Default: video, audio, and guaranteed mix disabled
  return {
    enableVideoQuests: false,
    enableAudioQuests: false,
    guaranteedMix: false
  };
}

/**
 * Save quest type preferences to storage
 */
export function saveQuestTypePreferences(preferences: QuestTypePreferences): void {
  try {
    localStorage.setItem(QUEST_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Failed to save quest type preferences
  }
}

/**
 * Update a single quest type preference
 */
export function updateQuestTypePreference(
  key: keyof QuestTypePreferences,
  value: boolean
): QuestTypePreferences {
  const current = getQuestTypePreferences();
  const updated = { ...current, [key]: value };
  saveQuestTypePreferences(updated);
  return updated;
}

// ============================================
// Visited Places Tracking
// ============================================

/**
 * Get all visited place IDs as a Set for fast O(1) lookup
 */
export function getVisitedPlaceIds(): Set<string> {
  try {
    const data = localStorage.getItem(VISITED_PLACES_KEY);
    if (!data) return new Set();

    const visitedData: VisitedPlacesData = JSON.parse(data);
    return new Set(visitedData.places.map(p => p.placeId));
  } catch {
    return new Set();
  }
}

/**
 * Get all visited places with full data for UI display
 */
export function getVisitedPlaces(): VisitedPlace[] {
  try {
    const data = localStorage.getItem(VISITED_PLACES_KEY);
    if (!data) return [];

    const visitedData: VisitedPlacesData = JSON.parse(data);
    // Parse dates
    return visitedData.places.map(p => ({
      ...p,
      visitedAt: new Date(p.visitedAt)
    }));
  } catch {
    return [];
  }
}

/**
 * Add a visited place (called on quest completion)
 * Uses LRU eviction when exceeding MAX_VISITED_PLACES
 */
export async function addVisitedPlace(place: {
  placeId: string;
  placeName: string;
  campaignId: string;
  coordinates: Coordinates;
}): Promise<void> {
  try {
    const current = getVisitedPlaces();
    const existingIndex = current.findIndex(p => p.placeId === place.placeId);

    let updatedPlaces: VisitedPlace[];

    if (existingIndex >= 0) {
      // Update existing place with enhanced tracking
      const existing = current[existingIndex];
      const updatedPlace: VisitedPlace = {
        ...existing,
        visitedAt: new Date(),
        lastCampaignDate: new Date(),
        visitCount: existing.visitCount + 1,
        campaignHistory: [
          ...existing.campaignHistory.slice(-VISITED_PLACE_CONFIG.MAX_CAMPAIGN_HISTORY + 1),
          place.campaignId
        ]
      };

      // Move to end (most recent)
      current.splice(existingIndex, 1);
      updatedPlaces = [...current, updatedPlace];
    } else {
      // Add new place with enhanced tracking
      const newPlace: VisitedPlace = {
        ...place,
        visitedAt: new Date(),
        visitCount: 1,
        lastCampaignDate: new Date(),
        campaignHistory: [place.campaignId]
      };
      updatedPlaces = [...current, newPlace];
    }

    // LRU eviction: remove oldest entries if over limit
    if (updatedPlaces.length > MAX_VISITED_PLACES) {
      updatedPlaces = updatedPlaces.slice(-MAX_VISITED_PLACES);
    }

    const visitedData: VisitedPlacesData = {
      places: updatedPlaces,
      lastUpdated: new Date()
    };
    localStorage.setItem(VISITED_PLACES_KEY, JSON.stringify(visitedData));
  } catch {
    // Failed to save visited place
  }
}

/**
 * Clear all visited places (user-triggered reset)
 */
export function clearVisitedPlaces(): void {
  try {
    localStorage.removeItem(VISITED_PLACES_KEY);
  } catch {
    // Failed to clear visited places
  }
}

/**
 * Migrate existing visited places to new schema with campaign tracking
 * This is a one-time operation that runs on app init
 */
export async function migrateVisitedPlacesV2(): Promise<void> {
  try {
    const existing = getVisitedPlaces();
    if (existing.length === 0) return;

    // Check if already migrated
    const firstPlace = existing[0] as any;
    if ('visitCount' in firstPlace && 'campaignHistory' in firstPlace) {
      return; // Already migrated
    }

    // Group by placeId to consolidate duplicates
    const consolidated = new Map<string, VisitedPlace>();

    for (const place of existing) {
      const existingPlace = consolidated.get(place.placeId);

      if (existingPlace) {
        // Merge duplicate entries
        existingPlace.visitCount++;
        if (!existingPlace.campaignHistory.includes(place.campaignId)) {
          existingPlace.campaignHistory.push(place.campaignId);
        }
        if (place.visitedAt > existingPlace.visitedAt) {
          existingPlace.visitedAt = place.visitedAt;
          existingPlace.lastCampaignDate = place.visitedAt;
        }
      } else {
        // Add new entry with enhanced fields
        consolidated.set(place.placeId, {
          ...place,
          visitCount: 1,
          lastCampaignDate: place.visitedAt,
          campaignHistory: [place.campaignId]
        });
      }
    }

    // Save migrated data
    const visitedData: VisitedPlacesData = {
      places: Array.from(consolidated.values()),
      lastUpdated: new Date()
    };
    localStorage.setItem(VISITED_PLACES_KEY, JSON.stringify(visitedData));

    console.log(`[Migration] Enhanced ${consolidated.size} visited places`);
  } catch (error) {
    console.error('[Migration] Failed to migrate visited places:', error);
  }
}

/**
 * Get count of visited places
 */
export function getVisitedPlacesCount(): number {
  try {
    const data = localStorage.getItem(VISITED_PLACES_KEY);
    if (!data) return 0;

    const visitedData: VisitedPlacesData = JSON.parse(data);
    return visitedData.places.length;
  } catch {
    return 0;
  }
}

/**
 * Migrate visited places from existing campaign history
 * Call once on app initialization to populate from past campaigns
 */
export async function migrateVisitedPlacesFromHistory(): Promise<number> {
  try {
    // Check if migration already done
    const existing = getVisitedPlaces();
    if (existing.length > 0) {
      return 0; // Already have data, skip migration
    }

    const history = await getCampaignHistory();
    let migratedCount = 0;

    for (const stored of history) {
      for (const quest of stored.campaign.quests) {
        // Only add places that have placeId (from Places API, not random coords)
        if (quest.coordinates && quest.placeName) {
          // Create a pseudo placeId from coordinates if not available
          const placeId = `${quest.coordinates.lat.toFixed(6)}_${quest.coordinates.lng.toFixed(6)}`;

          addVisitedPlace({
            placeId,
            placeName: quest.placeName,
            campaignId: stored.campaign.id,
            coordinates: quest.coordinates
          });
          migratedCount++;
        }
      }
    }

    return migratedCount;
  } catch {
    return 0;
  }
}

// ============================================
// Streak Tracking
// ============================================

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Check if two dates are consecutive days
 */
function isConsecutiveDay(previousDate: string, currentDate: string): boolean {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);
  const diffTime = curr.getTime() - prev.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

/**
 * Check if date is the same day
 */
function isSameDay(date1: string, date2: string): boolean {
  return date1 === date2;
}

/**
 * Get current streak data
 */
export function getStreakData(): StreakData {
  try {
    const data = localStorage.getItem(STREAK_DATA_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Failed to load streak data
  }
  return {
    lastPlayDate: '',
    consecutiveDays: 0,
  };
}

/**
 * Update streak on quest completion
 * Returns the updated consecutive days count
 */
export async function updateStreak(): Promise<number> {
  const today = getTodayString();
  const current = getStreakData();

  let newConsecutiveDays = 1;

  if (current.lastPlayDate) {
    if (isSameDay(current.lastPlayDate, today)) {
      // Already played today, don't update streak
      return current.consecutiveDays;
    } else if (isConsecutiveDay(current.lastPlayDate, today)) {
      // Consecutive day! Increment streak
      newConsecutiveDays = current.consecutiveDays + 1;
    }
    // Otherwise streak resets to 1
  }

  const newData: StreakData = {
    lastPlayDate: today,
    consecutiveDays: newConsecutiveDays,
  };

  try {
    localStorage.setItem(STREAK_DATA_KEY, JSON.stringify(newData));
  } catch {
    // Failed to save streak data
  }

  return newConsecutiveDays;
}

/**
 * Get current streak count without updating
 */
export function getCurrentStreak(): number {
  const today = getTodayString();
  const current = getStreakData();

  if (!current.lastPlayDate) {
    return 0;
  }

  // If last play was today, return current streak
  if (isSameDay(current.lastPlayDate, today)) {
    return current.consecutiveDays;
  }

  // If last play was yesterday, streak is still valid
  if (isConsecutiveDay(current.lastPlayDate, today)) {
    return current.consecutiveDays;
  }

  // Streak has been broken
  return 0;
}

// ============================================
// User Profile
// ============================================

/**
 * Get user profile from localStorage
 */
export function getUserProfile(): UserProfile | null {
  try {
    const data = localStorage.getItem(USER_PROFILE_KEY);
    if (data) {
      const profile = JSON.parse(data);
      // Parse dates
      profile.createdAt = new Date(profile.createdAt);
      profile.updatedAt = new Date(profile.updatedAt);
      return profile;
    }
  } catch {
    // Failed to load user profile
  }
  return null;
}

/**
 * Save user profile to localStorage
 */
export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Failed to save user profile
  }
}

/**
 * Create or update user profile
 */
export function updateUserProfile(updates: Partial<Omit<UserProfile, 'createdAt' | 'updatedAt'>>): UserProfile {
  const existing = getUserProfile();
  const now = new Date();

  const profile: UserProfile = {
    username: updates.username ?? existing?.username ?? 'Adventurer',
    avatarId: updates.avatarId ?? existing?.avatarId ?? 'compass',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  saveUserProfile(profile);
  return profile;
}

/**
 * Get avatar option by ID
 */
export function getAvatarById(avatarId: string): AvatarOption | undefined {
  return AVATAR_OPTIONS.find(a => a.id === avatarId);
}
