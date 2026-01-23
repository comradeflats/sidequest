import { Campaign, VerificationResult, JourneyStats, StoredCampaign, PlayerProgress, LEVEL_THRESHOLDS } from '../types';
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
const MAX_HISTORY_SIZE = 10;

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

  // Save campaign metadata to localStorage (without images to stay under quota)
  saveToLocalStorage(campaign, progress, journeyStats);
}

/**
 * Save campaign metadata to localStorage (without images)
 */
function saveToLocalStorage(
  campaign: Campaign,
  progress: {
    currentQuestIndex: number;
    completedQuests: string[];
    verificationResults?: Record<string, VerificationResult>;
  },
  journeyStats?: JourneyStats
): void {
  try {
    // Always save without images to localStorage (images are in IndexedDB)
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
  // Load metadata from localStorage
  const stored = loadFromLocalStorage(campaignId);
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
 * Load campaign metadata from localStorage
 */
function loadFromLocalStorage(campaignId: string): StoredCampaign | null {
  try {
    const data = localStorage.getItem(`campaign_${campaignId}`);
    if (!data) {
      return null;
    }

    const stored: StoredCampaign = JSON.parse(data);

    // Parse dates
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

    return stored;
  } catch {
    return null;
  }
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
    const stored = loadFromLocalStorage(campaignId);
    if (stored) {
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
export function addToHistory(campaignId: string): void {
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
      const campaign = loadFromLocalStorage(campaignId);
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
 * Get player progress from storage
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
export function addXP(amount: number): PlayerProgress {
  const current = getPlayerProgress();
  const previousLevel = current.level;

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
