// Type-safe analytics event tracking for Google Analytics 4

// Media types for analytics tracking
type AnalyticsMediaType = 'photo' | 'video' | 'audio';

export type AnalyticsEvent =
  | { name: 'campaign_created'; params: { location: string; type: 'short' | 'long'; distance_range: string; quest_count: number } }
  | { name: 'verification_attempt'; params: { quest_id: string; quest_index: number; media_type: AnalyticsMediaType } }
  | { name: 'verification_success'; params: { quest_id: string; quest_index: number; media_type: AnalyticsMediaType } }
  | { name: 'verification_failure'; params: { quest_id: string; quest_index: number; appealable: boolean; media_type: AnalyticsMediaType } }
  | { name: 'appeal_submitted'; params: { quest_id: string; gps_distance: number | null; media_type?: AnalyticsMediaType } }
  | { name: 'appeal_success'; params: { quest_id: string } }
  | { name: 'quest_completed'; params: { quest_id: string; quest_index: number; total_quests: number } }
  | { name: 'campaign_completed'; params: { campaign_id: string; total_distance: number; duration_minutes: number; quest_count: number } }
  | { name: 'campaign_abandoned'; params: { campaign_id: string; quests_completed: number; total_quests: number } };

/**
 * Track an analytics event to Google Analytics 4
 *
 * @param event - The analytics event to track
 *
 * @example
 * ```typescript
 * trackEvent({
 *   name: 'campaign_created',
 *   params: {
 *     location: 'Da Nang, Vietnam',
 *     type: 'long',
 *     distance_range: 'MARATHON',
 *     quest_count: 5
 *   }
 * });
 * ```
 */
export const trackEvent = (event: AnalyticsEvent) => {
  // Only track events in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Check if GA is initialized
  if (!window.gtag) {
    return;
  }

  try {
    // Send event to GA4
    window.gtag('event', event.name, event.params);
  } catch {
    // Analytics tracking failed silently
  }
};

// Type definitions for gtag function
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event',
      targetId: string,
      params?: Record<string, string | number | boolean | null | undefined>
    ) => void;
    dataLayer?: unknown[];
  }
}
