import { Campaign, VerificationResult, JourneyStats, StoredCampaign } from '../types';

// Storage keys
const CURRENT_CAMPAIGN_KEY = 'current_campaign_id';
const CAMPAIGN_HISTORY_KEY = 'campaign_history';
const MAX_HISTORY_SIZE = 10;

/**
 * Save a campaign to localStorage
 */
export function saveCampaign(
  campaign: Campaign,
  progress: {
    currentQuestIndex: number;
    completedQuests: string[];
    verificationResults?: Record<string, VerificationResult>;
  },
  journeyStats?: JourneyStats
): void {
  try {
    // Create a lightweight copy WITHOUT base64 images to avoid quota errors
    const campaignToStore = {
      ...campaign,
      quests: campaign.quests.map(quest => ({
        ...quest,
        imageUrl: undefined,  // Strip base64 images (will regenerate on resume)
        // Keep all other quest metadata
      }))
    };

    const stored: StoredCampaign = {
      campaign: campaignToStore,  // Use stripped version
      completedAt: null,
      lastPlayedAt: new Date(),
      progress: {
        currentQuestIndex: progress.currentQuestIndex,
        completedQuests: progress.completedQuests,
        verificationResults: progress.verificationResults || {}
      },
      journeyStats
    };

    // Save campaign data (now ~5KB instead of ~335KB)
    localStorage.setItem(`campaign_${campaign.id}`, JSON.stringify(stored));

    // Update current campaign ID
    localStorage.setItem(CURRENT_CAMPAIGN_KEY, campaign.id);

    console.log(`[Storage] Saved campaign ${campaign.id} at quest ${progress.currentQuestIndex} (images excluded)`);
  } catch (error) {
    console.error('[Storage] Failed to save campaign:', error);
  }
}

/**
 * Load a campaign from localStorage
 */
export function loadCampaign(campaignId: string): StoredCampaign | null {
  try {
    const data = localStorage.getItem(`campaign_${campaignId}`);
    if (!data) return null;

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

    console.log(`[Storage] Loaded campaign ${campaignId}`);
    return stored;
  } catch (error) {
    console.error('[Storage] Failed to load campaign:', error);
    return null;
  }
}

/**
 * Get the current active campaign ID
 */
export function getCurrentCampaignId(): string | null {
  return localStorage.getItem(CURRENT_CAMPAIGN_KEY);
}

/**
 * Clear the current campaign (user finished or abandoned)
 */
export function clearCurrentCampaign(): void {
  localStorage.removeItem(CURRENT_CAMPAIGN_KEY);
  console.log('[Storage] Cleared current campaign');
}

/**
 * Mark a campaign as completed
 */
export function markCampaignComplete(campaignId: string): void {
  try {
    const stored = loadCampaign(campaignId);
    if (!stored) return;

    stored.completedAt = new Date();
    localStorage.setItem(`campaign_${campaignId}`, JSON.stringify(stored));

    console.log(`[Storage] Marked campaign ${campaignId} as complete`);
  } catch (error) {
    console.error('[Storage] Failed to mark campaign complete:', error);
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
    console.log(`[Storage] Added campaign ${campaignId} to history`);
  } catch (error) {
    console.error('[Storage] Failed to add to history:', error);
  }
}

/**
 * Get campaign history (array of StoredCampaign objects)
 */
export function getCampaignHistory(): StoredCampaign[] {
  try {
    const historyData = localStorage.getItem(CAMPAIGN_HISTORY_KEY);
    if (!historyData) return [];

    const history: string[] = JSON.parse(historyData);
    const campaigns: StoredCampaign[] = [];

    for (const campaignId of history) {
      const campaign = loadCampaign(campaignId);
      if (campaign) {
        campaigns.push(campaign);
      }
    }

    return campaigns;
  } catch (error) {
    console.error('[Storage] Failed to get campaign history:', error);
    return [];
  }
}

/**
 * Delete a campaign from storage
 */
export function deleteCampaign(campaignId: string): void {
  try {
    localStorage.removeItem(`campaign_${campaignId}`);
    localStorage.removeItem(`journey_${campaignId}`);
    console.log(`[Storage] Deleted campaign ${campaignId}`);
  } catch (error) {
    console.error('[Storage] Failed to delete campaign:', error);
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
    console.log(`[Storage] Cleared all SideQuest data (${keys.length} items)`);
  } catch (error) {
    console.error('[Storage] Failed to clear all data:', error);
  }
}
