'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Compass, Zap, CheckCircle, XCircle, Camera, Video, Mic, Navigation, MessageSquare, ExternalLink, RefreshCw, Info } from 'lucide-react';
import { generateCampaign, verifyMedia, verifyMediaWithAppeal } from '@/lib/game-logic';
import { geocodeLocation } from '@/lib/location';
import { generateQuestImage, generateQuestImageWithDetails } from '@/lib/gemini';
import { Campaign, VerificationResult, DistanceRange, LocationData, Coordinates, AppealData, MediaCaptureData, XP_REWARDS, XP_DISTANCE_BONUS_PER_KM, getStreakBonus, QuestType, CampaignOptions, StoredCampaign, LocationResearch } from '@/types';
import { trackEvent } from '@/lib/analytics';
import MediaScanner from '@/components/MediaScanner';
import DistanceRangeSelector from '@/components/DistanceRangeSelector';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useJourneyTracking } from '@/hooks/useJourneyTracking';
import AppealDialog from '@/components/AppealDialog';
import JourneyMap from '@/components/JourneyMap';
import JourneyStatsCard from '@/components/JourneyStatsCard';
import QuestBook from '@/components/QuestBook';
import LoadingProgress from '@/components/LoadingProgress';
import QuestPreview from '@/components/QuestPreview';
import ThinkingPanel from '@/components/ThinkingPanel';
import CollapsibleToolbar from '@/components/CollapsibleToolbar';
import ImageGenerationError, { ImageErrorDetails } from '@/components/ImageGenerationError';
import LocationInfoModal from '@/components/LocationInfoModal';
import {
  getCurrentCampaignId,
  loadCampaign,
  saveCampaign,
  clearCurrentCampaign,
  markCampaignComplete,
  addToHistory,
  getCampaignHistory,
  addXP,
  addVisitedPlace,
  migrateVisitedPlacesFromHistory,
  updateStreak
} from '@/lib/storage';
import { useSessionContext } from '@/hooks/useSessionContext';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistance } from '@/lib/units';

export default function Home() {
  const [location, setLocation] = useState('');
  const [distanceRange, setDistanceRange] = useState<DistanceRange | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  // Geocoding State
  const [geocodedLocation, setGeocodedLocation] = useState<LocationData | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Scanner & Verification State
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // GPS & Appeal State
  const [userGps, setUserGps] = useState<Coordinates | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [lastCaptureData, setLastCaptureData] = useState<MediaCaptureData | null>(null);
  const [isAppealing, setIsAppealing] = useState(false);

  // Journey Tracking State
  const [showJourneyMap, setShowJourneyMap] = useState(false);

  // Campaign Persistence State
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  // Image Generation Progress State
  const [imageProgress, setImageProgress] = useState<{current: number, total: number} | null>(null);

  // Image Generation Error State
  const [imageGenErrors, setImageGenErrors] = useState<ImageErrorDetails[]>([]);
  const [retryingImages, setRetryingImages] = useState<Set<string>>(new Set());

  // Background Tab State
  const [isPausedDueToBackground, setIsPausedDueToBackground] = useState(false);

  // Quest Book State
  const [showQuestBook, setShowQuestBook] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<StoredCampaign[]>([]);

  // XP State
  const [xpGain, setXpGain] = useState<{ amount: number; timestamp: number } | null>(null);

  // Location Info Modal State
  const [showLocationInfo, setShowLocationInfo] = useState(false);

  // Ref for auto-scrolling to loading area on setup page
  const loadingRef = useRef<HTMLDivElement>(null);

  // Initialize GPS tracking hook
  const geoState = useGeolocation(gpsEnabled);
  const { refreshLocation, isRefreshing, error: gpsError, permissionStatus } = geoState;
  const [gpsRefreshFailed, setGpsRefreshFailed] = useState(false);

  // Initialize journey tracking hook
  const {
    journeyStats,
    recordPoint,
    markQuestComplete,
    finalizeJourney,
    resetWithStats
  } = useJourneyTracking({
    enabled: !!campaign,
    currentQuestIndex: campaign?.currentQuestIndex || 0,
    onJourneyUpdate: (stats) => {
      // Persist to localStorage for session continuity
      if (campaign) {
        localStorage.setItem(`journey_${campaign.id}`, JSON.stringify(stats));
      }
    }
  });

  // Initialize session context hook (Gemini 3 Marathon Agent feature)
  const {
    context: sessionContext,
    recordAttempt: recordSessionAttempt,
    startAttempt: startSessionAttempt,
    getVerificationHint,
    getContextTokenCount,
    getTokenBreakdown,
    resetContext: resetSessionContext
  } = useSessionContext({
    campaignId: campaign?.id || null,
    campaign: campaign,  // Pass full campaign for location research
    journeyStats: journeyStats,  // Pass journey stats for analytics
    enabled: !!campaign
  });

  // Initialize unit preference hook
  const { unitSystem, toggleUnit } = useUnitPreference();

  // Generate placeholder image based on location type
  const generatePlaceholderImage = (quest: { title: string; locationHint: string }): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 450;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    // Determine gradient colors based on location type
    const locationLower = quest.locationHint.toLowerCase();
    let gradientColors: [string, string] = ['#10b981', '#065f46']; // Default: emerald green

    if (locationLower.includes('park') || locationLower.includes('nature') || locationLower.includes('forest') || locationLower.includes('garden')) {
      gradientColors = ['#10b981', '#065f46']; // Emerald green
    } else if (locationLower.includes('water') || locationLower.includes('beach') || locationLower.includes('lake') || locationLower.includes('river')) {
      gradientColors = ['#0ea5e9', '#0369a1']; // Blue
    } else if (locationLower.includes('city') || locationLower.includes('urban') || locationLower.includes('street') || locationLower.includes('building')) {
      gradientColors = ['#64748b', '#334155']; // Gray/blue
    } else if (locationLower.includes('mountain') || locationLower.includes('hill')) {
      gradientColors = ['#78716c', '#44403c']; // Stone gray
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, gradientColors[0]);
    gradient.addColorStop(1, gradientColors[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add subtle pattern for texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let i = 0; i < canvas.width; i += 20) {
      for (let j = 0; j < canvas.height; j += 20) {
        if ((i + j) % 40 === 0) {
          ctx.fillRect(i, j, 10, 10);
        }
      }
    }

    // Add quest title overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    ctx.fillStyle = '#fbbf24'; // Gold
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(quest.title, canvas.width / 2, canvas.height - 35);

    return canvas.toDataURL('image/png');
  };

  // Update GPS state when geolocation changes
  useEffect(() => {
    if (geoState.coordinates && geoState.accuracy) {
      setUserGps(geoState.coordinates);
      setGpsAccuracy(geoState.accuracy);

      // Record journey point if campaign is active
      if (campaign) {
        recordPoint(geoState.coordinates, geoState.accuracy);
      }
    }
  }, [geoState, campaign, recordPoint]);

  // Enable GPS when campaign starts
  useEffect(() => {
    if (campaign) {
      setGpsEnabled(true);
    } else {
      setGpsEnabled(false);
    }
  }, [campaign]);

  // Restore campaign on mount and migrate visited places
  useEffect(() => {
    const initializeApp = async () => {
      // Migrate visited places from history (one-time operation)
      await migrateVisitedPlacesFromHistory();

      // Check for existing campaign
      const activeCampaignId = await getCurrentCampaignId();
      if (activeCampaignId && !campaign) {
        const stored = await loadCampaign(activeCampaignId);
        if (stored && !stored.completedAt) {
          // Always show resume prompt - images will be loaded from IndexedDB or regenerated if missing
          setSavedCampaignId(activeCampaignId);
          setShowResumePrompt(true);
        }
      }
    };
    initializeApp();
  }, []); // Run once on mount

  // Auto-save campaign when state changes
  useEffect(() => {
    if (campaign) {
      saveCampaign(
        campaign,
        {
          currentQuestIndex: campaign.currentQuestIndex,
          completedQuests,
          verificationResults: {} // Optional: could save verification history
        },
        journeyStats || undefined
      );
    }
  }, [campaign, completedQuests, journeyStats]);

  // Load campaign history when component mounts or campaign changes
  useEffect(() => {
    const loadHistory = async () => {
      const history = await getCampaignHistory();
      setCampaignHistory(history);
    };
    loadHistory();
  }, [campaign]); // Refresh when campaign changes (e.g., completion)

  // Auto-scroll to loading area on setup page when loading starts
  useEffect(() => {
    if (isLoading && !campaign && loadingRef.current) {
      // Small delay to ensure the loading component is rendered
      setTimeout(() => {
        loadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isLoading, campaign]);

  // Handle page visibility changes (background tab detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && (isLoading || isResuming)) {
        // User switched away while generation is in progress
        setIsPausedDueToBackground(true);
      } else if (!document.hidden) {
        // User came back
        setIsPausedDueToBackground(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoading, isResuming]);

  const handleGeocodeLocation = async () => {
    if (!location.trim()) return;

    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const locationData = await geocodeLocation(location);
      setGeocodedLocation(locationData);
    } catch {
      setGeocodeError('Location not found. Try a full address or city name.');
      setGeocodedLocation(null);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleChangeLocation = () => {
    setGeocodedLocation(null);
    setGeocodeError(null);
  };

  const handleResumeCampaign = async () => {
    if (!savedCampaignId) return;

    const stored = await loadCampaign(savedCampaignId);
    if (!stored) {
      // Handle case where stored campaign is corrupted or missing
      setShowResumePrompt(false);
      setSavedCampaignId(null);
      return;
    }

    setShowResumePrompt(false);

    // Check if images need to be regenerated (Firebase will provide images if available)
    const questsNeedingImages = stored.campaign.quests.filter(q => !q.imageUrl);

    if (questsNeedingImages.length > 0) {
      // Show loading only if we need to regenerate images
      setIsLoading(true);
      setIsResuming(true);
      setImageProgress(null);

      try {
        // Parallel regeneration with live progress tracking
        let completedCount = 0;
        const newErrors: ImageErrorDetails[] = [];

        const imagePromises = questsNeedingImages.map(async (quest) => {
          try {
            const result = await generateQuestImageWithDetails(quest, 30000, 1);
            completedCount++;
            setImageProgress({ current: completedCount, total: questsNeedingImages.length });

            if (result.url) {
              quest.imageUrl = result.url;
            } else {
              // First failure - track for retry UI
              quest.imageUrl = undefined;
              if (result.error) {
                newErrors.push({
                  questId: quest.id,
                  questTitle: quest.title,
                  errorType: result.error,
                  retries: 1
                });
              }
            }
          } catch {
            // Continue even if image fails
            completedCount++;
            setImageProgress({ current: completedCount, total: questsNeedingImages.length });
            quest.imageUrl = undefined;
            newErrors.push({
              questId: quest.id,
              questTitle: quest.title,
              errorType: 'unknown',
              retries: 1
            });
          }
          return quest;
        });

        await Promise.all(imagePromises);

        // Set errors after all attempts complete
        if (newErrors.length > 0) {
          setImageGenErrors(newErrors);
        }
      } catch {
        // Failed to regenerate images
      } finally {
        setIsLoading(false);
        setIsResuming(false);
        setImageProgress(null);
      }
    }

    // Restore campaign (with existing or regenerated images)
    setCampaign(stored.campaign);
    setCompletedQuests(stored.progress.completedQuests);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Restore journey stats if available
    if (stored.journeyStats) {
      resetWithStats(stored.journeyStats);
    }

    setSavedCampaignId(null);
  };

  // Rotating messages for different loading states
  const RESUME_MESSAGES = [
    "RESTORING YOUR ADVENTURE...",
    "LOADING QUEST DATA...",
    "REGENERATING QUEST IMAGES...",
    "PREPARING YOUR JOURNEY...",
    "ALMOST THERE...",
    "PERFECTING THE DETAILS...",
    "FINAL TOUCHES...",
    "CRAFTING PIXEL PERFECTION...",
    "WORTH THE WAIT..."
  ];

  const GENERATE_MESSAGES = [
    "SCOUTING THE AREA...",
    "PLANNING YOUR ADVENTURE...",
    "DISCOVERING HIDDEN SPOTS...",
    "CHARTING YOUR COURSE...",
    "CONSULTING ANCIENT MAPS...",
    "FINDING LEGENDARY LOCATIONS..."
  ];

  const VERIFICATION_MESSAGES = [
    "PROCESSING YOUR SUBMISSION...",
    "ANALYZING QUEST CRITERIA...",
    "CONSULTING THE AI ORACLE...",
    "EVALUATING YOUR CAPTURE...",
    "CROSS-REFERENCING OBJECTIVES...",
    "VERIFYING COMPLETION...",
    "RUNNING ANALYSIS..."
  ];

  const handleDeclineResume = async () => {
    if (savedCampaignId) {
      await clearCurrentCampaign();
    }
    setShowResumePrompt(false);
    setSavedCampaignId(null);
  };

  const handleRetryImage = async (questId: string) => {
    if (!campaign) return;

    // Mark as retrying
    setRetryingImages(prev => new Set(prev).add(questId));

    // Find the quest
    const quest = campaign.quests.find(q => q.id === questId);
    if (!quest) return;

    try {
      // Retry with extended 45s timeout
      const result = await generateQuestImageWithDetails(quest, 45000, 1);

      if (result.url) {
        // Success! Update the quest
        quest.imageUrl = result.url;
        setCampaign({ ...campaign });

        // Remove from errors
        setImageGenErrors(prev => prev.filter(e => e.questId !== questId));
      } else {
        // Still failed - update error with new attempt count
        setImageGenErrors(prev =>
          prev.map(e =>
            e.questId === questId
              ? { ...e, retries: e.retries + 1, errorType: result.error || 'unknown' }
              : e
          )
        );
      }
    } catch {
      // Retry failed
      setImageGenErrors(prev =>
        prev.map(e =>
          e.questId === questId ? { ...e, retries: e.retries + 1 } : e
        )
      );
    } finally {
      // Remove from retrying set
      setRetryingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(questId);
        return newSet;
      });
    }
  };

  const handleUsePlaceholder = (questId: string) => {
    if (!campaign) return;

    const quest = campaign.quests.find(q => q.id === questId);
    if (!quest) return;

    // Generate and use placeholder
    quest.imageUrl = generatePlaceholderImage(quest);
    setCampaign({ ...campaign });

    // Remove from errors
    setImageGenErrors(prev => prev.filter(e => e.questId !== questId));
  };

  const handleDismissError = (questId: string) => {
    setImageGenErrors(prev => prev.filter(e => e.questId !== questId));
  };

  const startAdventure = async (type: 'short' | 'long') => {
    if (!geocodedLocation || !distanceRange) return;

    // Clear any previous campaign and session context
    await clearCurrentCampaign();
    setCompletedQuests([]);
    resetSessionContext();
    setImageProgress(null);
    setImageGenErrors([]);

    setIsLoading(true);
    try {
      // Always use guaranteed mix mode: 1 photo, 1 video, 1 audio quest
      const campaignOptions: CampaignOptions = {
        enableVideoQuests: true,
        enableAudioQuests: true,
        guaranteedMix: true,
        onProgress: (current, total) => {
          setImageProgress({ current, total });
        }
      };

      // Use geocodedLocation.name to pass to generateCampaign (which will geocode again)
      // The function will re-geocode, but we've already confirmed the location is valid
      const newCampaign = await generateCampaign(geocodedLocation.name, type, distanceRange, campaignOptions);

      // Show campaign immediately - images are already generated by generateCampaign
      setCampaign(newCampaign);
      setIsLoading(false);
      setImageProgress(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Track campaign creation
      trackEvent({
        name: 'campaign_created',
        params: {
          location: geocodedLocation.name,
          type: type,
          distance_range: distanceRange,
          quest_count: newCampaign.quests.length
        }
      });
    } catch (error: unknown) {
      setIsLoading(false);
      setImageProgress(null);

      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize adventure.';
      // Show user-friendly error without exposing technical details
      if (errorMessage.includes('API key')) {
        alert('Configuration error. Please contact support.');
      } else {
        alert('Failed to create adventure. Please try again.');
      }
    }
  };

  const handleCapture = async (captureData: MediaCaptureData) => {
    setIsScanning(false);
    setIsVerifying(true);
    setLastCaptureData(captureData); // Store for potential appeal

    if (!campaign) return;

    const currentQuest = campaign.quests[campaign.currentQuestIndex];
    const mediaType = captureData.type;

    // Start session attempt tracking (Gemini 3 Marathon Agent)
    startSessionAttempt(currentQuest.id);

    try {
      // Force fresh GPS reading before verification for accurate location boost
      const freshGps = await refreshLocation();
      const verificationGps = freshGps || userGps;
      const verificationAccuracy = freshGps ? gpsAccuracy : gpsAccuracy;

      // Track verification attempt
      trackEvent({
        name: 'verification_attempt',
        params: {
          quest_id: currentQuest.id,
          quest_index: campaign.currentQuestIndex,
          media_type: mediaType
        }
      });

      // Get session context hint for personalized AI responses (Gemini 3 1M Context)
      const sessionContextHint = getVerificationHint();

      // Verify the media using unified verifyMedia function
      const verification = await verifyMedia(
        captureData,
        currentQuest.objective,
        currentQuest.secretCriteria,
        currentQuest.mediaRequirements,
        verificationGps || undefined,
        currentQuest.coordinates,
        verificationAccuracy || undefined,
        sessionContextHint
      );

      setResult(verification);

      // Record session attempt with thinking data (Gemini 3 Marathon Agent)
      recordSessionAttempt({
        questId: currentQuest.id,
        questTitle: currentQuest.title,
        questType: currentQuest.questType || 'PHOTO',
        success: verification.success,
        feedback: verification.feedback,
        thinkingSteps: verification.thinking,
        distanceFromTarget: verification.distanceFromTarget,
        questImageUrl: currentQuest.imageUrl  // Include quest image for context
      });

      // Track verification result
      if (verification.success) {
        trackEvent({
          name: 'verification_success',
          params: {
            quest_id: currentQuest.id,
            quest_index: campaign.currentQuestIndex,
            media_type: mediaType
          }
        });
      } else {
        trackEvent({
          name: 'verification_failure',
          params: {
            quest_id: currentQuest.id,
            quest_index: campaign.currentQuestIndex,
            appealable: verification.appealable || false,
            media_type: mediaType
          }
        });
      }
    } catch {
      alert('Verification failed. Please check your connection and try again.');
      setIsVerifying(false);
    }
  };

  const handleAppealSubmit = async (explanation: string) => {
    if (!campaign || !lastCaptureData) return;

    setIsAppealing(true);
    const currentQuest = campaign.quests[campaign.currentQuestIndex];

    try {
      const appealData: AppealData = {
        userExplanation: explanation,
        userGpsCoordinates: userGps,
        distanceFromTarget: result?.distanceFromTarget || null,
        timestamp: new Date()
      };

      // Track appeal submission
      trackEvent({
        name: 'appeal_submitted',
        params: {
          quest_id: currentQuest.id,
          gps_distance: appealData.distanceFromTarget,
          media_type: lastCaptureData.type
        }
      });

      const appealResult = await verifyMediaWithAppeal(
        lastCaptureData,
        currentQuest.objective,
        currentQuest.secretCriteria,
        appealData,
        currentQuest.coordinates!,
        currentQuest.mediaRequirements
      );

      // Convert AppealResult to VerificationResult
      setResult({
        success: appealResult.success,
        feedback: appealResult.feedback,
        reasoning: appealResult.reasoning
      });

      // Record session attempt after appeal (Gemini 3 Marathon Agent)
      recordSessionAttempt({
        questId: currentQuest.id,
        questTitle: currentQuest.title,
        questType: currentQuest.questType || 'PHOTO',
        success: appealResult.success,
        feedback: appealResult.feedback,
        distanceFromTarget: result?.distanceFromTarget,
        questImageUrl: currentQuest.imageUrl  // Include quest image for context
      });

      // Track appeal result
      if (appealResult.success) {
        trackEvent({
          name: 'appeal_success',
          params: {
            quest_id: currentQuest.id
          }
        });
      }

      setShowAppealDialog(false);
    } catch {
      alert('Unable to process appeal. Please try again.');
    } finally {
      setIsAppealing(false);
    }
  };

  const nextQuest = async () => {
    if (!campaign) return;

    // Mark quest as complete in journey
    markQuestComplete();

    // Add current quest to completed list
    const currentQuest = campaign.quests[campaign.currentQuestIndex];
    setCompletedQuests(prev => [...prev, currentQuest.id]);

    // Track visited place for location variety in future campaigns
    if (currentQuest.coordinates && currentQuest.placeName) {
      // Use actual placeId from Places API, or fallback to coordinates-based ID
      const placeId = currentQuest.placeId || `${currentQuest.coordinates.lat.toFixed(6)}_${currentQuest.coordinates.lng.toFixed(6)}`;
      await addVisitedPlace({
        placeId,
        placeName: currentQuest.placeName,
        campaignId: campaign.id,
        coordinates: currentQuest.coordinates
      });
    }

    // Award XP based on quest difficulty + bonuses
    let xpAmount = XP_REWARDS[currentQuest.difficulty] || XP_REWARDS.medium;

    // Distance bonus: +10 XP per km traveled in this journey
    if (journeyStats && journeyStats.totalDistanceTraveled > 0) {
      const distanceBonus = Math.floor(journeyStats.totalDistanceTraveled * XP_DISTANCE_BONUS_PER_KM);
      xpAmount += distanceBonus;
    }

    // Streak bonus: update streak and get bonus (async now for cloud sync)
    const consecutiveDays = await updateStreak();
    const streakBonus = getStreakBonus(consecutiveDays);
    xpAmount += streakBonus;

    await addXP(xpAmount);
    setXpGain({ amount: xpAmount, timestamp: Date.now() });

    // Track quest completion
    trackEvent({
      name: 'quest_completed',
      params: {
        quest_id: currentQuest.id,
        quest_index: campaign.currentQuestIndex,
        total_quests: campaign.quests.length
      }
    });

    const nextIndex = campaign.currentQuestIndex + 1;
    if (nextIndex < campaign.quests.length) {
      setCampaign({ ...campaign, currentQuestIndex: nextIndex });
      setResult(null);
      setIsVerifying(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Campaign complete! Mark it and add to history
      await markCampaignComplete(campaign.id);
      await addToHistory(campaign.id);

      // Finalize journey before showing completion
      const finalStats = finalizeJourney();

      // Track campaign completion
      trackEvent({
        name: 'campaign_completed',
        params: {
          campaign_id: campaign.id,
          total_distance: campaign.totalDistance || 0,
          duration_minutes: finalStats?.durationMinutes || 0,
          quest_count: campaign.quests.length
        }
      });

      // Show journey map instead of alert
      setShowJourneyMap(true);
    }
  };

  const retryQuest = () => {
    setResult(null);
    setIsVerifying(false);
  };

  // Open quest location on Google Maps - use name+coordinates for reliable results
  const viewQuestArea = (quest: { coordinates?: Coordinates; placeName?: string; placeId?: string }) => {
    // Priority 1: Search by name WITH place_id for exact match (most reliable)
    if (quest.placeName && quest.placeId) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(quest.placeName)}&query_place_id=${quest.placeId}`, '_blank');
      return;
    }

    // Priority 2: Search by name WITH coordinates to anchor the search location
    if (quest.placeName && quest.coordinates) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(quest.placeName)}`, '_blank');
      return;
    }

    // Priority 3: Just coordinates - open at that location
    if (quest.coordinates) {
      window.open(`https://www.google.com/maps/@${quest.coordinates.lat},${quest.coordinates.lng},17z`, '_blank');
    }
  };

  // Find location research for current quest
  const getCurrentLocationResearch = (): LocationResearch | null => {
    if (!campaign || !campaign.locationResearch) return null;

    const currentQuest = campaign.quests[campaign.currentQuestIndex];
    if (!currentQuest.placeName) return null;

    // Match by placeName
    return campaign.locationResearch.find(
      research => research.placeName === currentQuest.placeName
    ) || null;
  };

  return (
    <main className="min-h-screen bg-black text-emerald-400 px-4 sm:px-6 py-6 overflow-x-hidden selection:bg-emerald-900 selection:text-emerald-100">
      {/* Unified Header Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 py-3">
        <div className="flex items-center justify-end max-w-md mx-auto relative">
          <CollapsibleToolbar
            campaign={campaign}
            onXPGain={xpGain}
            onOpenQuestBook={() => setShowQuestBook(true)}
            unitSystem={unitSystem}
            onToggleUnit={toggleUnit}
            contextTokenCount={getContextTokenCount()}
            questHistoryCount={sessionContext?.questHistory.length || 0}
            contextTokenBreakdown={getTokenBreakdown()}
          />
        </div>
      </div>

      <div className="max-w-md mx-auto pt-16 pb-20">
        <header className="mb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-pixel text-adventure-gold mb-3 drop-shadow-lg"
            style={{ fontSize: '2rem', lineHeight: '1.4' }}
          >
            SIDEQUEST
          </motion.h1>
          <p className="text-adventure-emerald text-sm font-sans italic">
            Explore your world, one quest at a time
          </p>
        </header>

        {/* Resume Campaign Prompt */}
        {showResumePrompt && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-adventure-gold/10 border-2 border-adventure-gold rounded-lg p-6"
          >
            <div className="flex items-start gap-3 mb-4">
              <Compass className="w-6 h-6 text-adventure-gold flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-pixel text-adventure-gold mb-2">
                  CONTINUE YOUR ADVENTURE?
                </h3>
                <p className="text-sm font-sans text-gray-300">
                  You have an unfinished quest. Would you like to resume where you left off?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleResumeCampaign}
                className="flex-1 bg-adventure-gold text-black font-pixel text-sm py-3 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                RESUME
              </button>
              <button
                onClick={handleDeclineResume}
                className="flex-1 bg-zinc-800 text-gray-400 font-pixel text-sm py-3 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                START NEW
              </button>
            </div>
          </motion.div>
        )}

        {/* Image Generation Errors */}
        {imageGenErrors.length > 0 && campaign && (
          <div className="space-y-3 mb-6">
            {imageGenErrors.map(error => (
              <ImageGenerationError
                key={error.questId}
                error={error}
                onRetry={handleRetryImage}
                onUsePlaceholder={handleUsePlaceholder}
                onDismiss={handleDismissError}
                isRetrying={retryingImages.has(error.questId)}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {isScanning && campaign && (
            <MediaScanner
              questType={campaign.quests[campaign.currentQuestIndex].questType || 'PHOTO'}
              mediaRequirements={campaign.quests[campaign.currentQuestIndex].mediaRequirements}
              onCapture={handleCapture}
              onCancel={() => setIsScanning(false)}
            />
          )}

          {!campaign ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Location Input */}
              <div className="space-y-2">
                <label className="block text-xs font-pixel text-adventure-gold">
                  LOCATION
                </label>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-adventure-brown group-focus-within:text-adventure-emerald transition-colors" />
                  <input
                    type="text"
                    placeholder="Enter city or street address"
                    className="w-full bg-zinc-900 border-2 border-adventure-brown rounded-lg py-4 pl-12 pr-24 focus:outline-none focus:border-adventure-emerald transition-colors placeholder:text-zinc-700 font-sans disabled:opacity-50"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      // Clear geocoded location when user changes input
                      if (geocodedLocation) {
                        setGeocodedLocation(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !geocodedLocation) {
                        handleGeocodeLocation();
                      }
                    }}
                    disabled={isGeocoding}
                  />
                  {!geocodedLocation && (
                    <button
                      onClick={handleGeocodeLocation}
                      disabled={isGeocoding || !location.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-pixel bg-adventure-emerald text-black rounded hover:bg-adventure-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isGeocoding ? '...' : 'GO'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-sans">
                  You can enter a full street address or just a city
                </p>

                {/* Address Confirmation Box */}
                {geocodedLocation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="bg-adventure-emerald/10 border-2 border-adventure-emerald rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-adventure-emerald flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-pixel text-adventure-emerald mb-1">
                          STARTING LOCATION
                        </p>
                        <p className="text-sm font-sans text-white">
                          {geocodedLocation.formattedAddress}
                        </p>
                      </div>
                      <button
                        onClick={handleChangeLocation}
                        className="text-xs text-adventure-gold hover:underline font-pixel"
                      >
                        CHANGE
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Error Message */}
                {geocodeError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-red-400 font-sans"
                  >
                    {geocodeError}
                  </motion.div>
                )}
              </div>

              {/* Distance Range Selector */}
              <DistanceRangeSelector
                selectedRange={distanceRange}
                onSelect={setDistanceRange}
                unitSystem={unitSystem}
              />

              {/* Campaign Type Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-pixel text-adventure-gold">
                  CAMPAIGN TYPE
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => startAdventure('short')}
                    disabled={isLoading || !geocodedLocation || !distanceRange}
                    className="pixel-btn flex flex-col items-center justify-center p-6 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group bg-zinc-900 border-adventure-emerald text-adventure-emerald hover:bg-adventure-emerald/10 disabled:hover:bg-zinc-900"
                  >
                    <Zap className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold font-pixel" style={{ fontSize: '0.7rem' }}>
                      QUICK HUNT
                    </span>
                    <span className="text-xs text-gray-500 mt-1 font-sans">2-3 quests</span>
                  </button>

                  <button
                    onClick={() => startAdventure('long')}
                    disabled={isLoading || !geocodedLocation || !distanceRange}
                    className="pixel-btn flex flex-col items-center justify-center p-6 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed group bg-zinc-900 border-adventure-purple text-adventure-purple hover:bg-adventure-purple/10 disabled:hover:bg-zinc-900"
                  >
                    <Compass className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold font-pixel" style={{ fontSize: '0.7rem' }}>
                      CITY ODYSSEY
                    </span>
                    <span className="text-xs text-gray-500 mt-1 font-sans">4-5 quests</span>
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div ref={loadingRef}>
                  {/* Background Tab Warning */}
                  {isPausedDueToBackground && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 bg-blue-900/20 border-2 border-blue-500 rounded-lg p-4 text-center"
                    >
                      <p className="text-sm font-pixel text-blue-400 mb-1">
                        ⏸ APP IN BACKGROUND
                      </p>
                      <p className="text-xs font-sans text-gray-300">
                        Generation continues - switch back to see progress
                      </p>
                    </motion.div>
                  )}

                  <LoadingProgress
                    message={isResuming ? "RESTORING YOUR ADVENTURE..." : "GENERATING YOUR ADVENTURE..."}
                    subMessage={isResuming ? "Loading your saved progress" : "Creating quests with Gemini 3"}
                    rotatingMessages={isResuming ? RESUME_MESSAGES : GENERATE_MESSAGES}
                    hint={!isResuming && !imageProgress ? "This can take 1-2 minutes - feel free to switch tabs!" : undefined}
                    progress={
                      imageProgress
                        ? Math.round((imageProgress.current / imageProgress.total) * 100)
                        : undefined
                    }
                    progressText={
                      imageProgress
                        ? `Generating quest images... (${imageProgress.current}/${imageProgress.total})`
                        : undefined
                    }
                  />
                </div>
              )}
            </motion.div>
          ) : isVerifying ? (
            <motion.div
              key="verifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-6 pt-12"
            >
              {!result ? (
                <LoadingProgress
                  message="ANALYZING..."
                  subMessage={`Verifying your ${lastCaptureData?.type || 'submission'}`}
                  rotatingMessages={VERIFICATION_MESSAGES}
                />
              ) : (
                <div className="space-y-6">
                  {result.success ? (
                    <CheckCircle className="w-20 h-20 text-adventure-emerald mx-auto drop-shadow-lg" />
                  ) : (
                    <XCircle className="w-20 h-20 text-red-500 mx-auto drop-shadow-lg" />
                  )}

                  <div className={`quest-card p-6 rounded-lg ${
                    result.success
                      ? 'border-adventure-emerald'
                      : 'border-red-500'
                  }`}>
                    <h3 className="text-xl font-pixel mb-3" style={{ fontSize: '0.9rem' }}>
                      {result.success ? 'QUEST COMPLETE' : 'TRY AGAIN'}
                    </h3>
                    <p className="text-sm font-sans text-white/90 italic leading-relaxed">
                      &ldquo;{result.feedback}&rdquo;
                    </p>

                    {/* AI Thinking Panel - Transparent Reasoning */}
                    {result.thinking && result.thinking.length > 0 && (
                      <ThinkingPanel
                        thinking={result.thinking}
                        overallConfidence={result.overallConfidence || 0}
                        distanceFromTarget={result.distanceFromTarget}
                        success={result.success}
                      />
                    )}
                  </div>

                  {result.success ? (
                    <button
                      onClick={nextQuest}
                      className="w-full bg-adventure-emerald text-black font-bold font-pixel py-4 px-6 rounded-lg hover:bg-adventure-gold transition-colors shadow-pixel-lg"
                      style={{ fontSize: '0.85rem' }}
                    >
                      NEXT QUEST →
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {result.appealable && (
                        <button
                          onClick={() => setShowAppealDialog(true)}
                          className="w-full bg-adventure-gold text-black font-bold font-pixel py-4 px-6 rounded-lg hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                          style={{ fontSize: '0.85rem' }}
                        >
                          <MessageSquare className="w-5 h-5" />
                          APPEAL TO AI JUDGE
                        </button>
                      )}
                      <button
                        onClick={retryQuest}
                        className="w-full border-2 border-red-500 text-red-400 font-bold font-pixel py-4 px-6 rounded-lg hover:bg-red-500/10 transition-colors"
                        style={{ fontSize: '0.85rem' }}
                      >
                        {lastCaptureData?.type === 'video' ? 'RECORD NEW VIDEO' :
                         lastCaptureData?.type === 'audio' ? 'RECORD NEW AUDIO' :
                         'TAKE NEW PHOTO'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="campaign"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              {(() => {
                const currentQuest = campaign.quests[campaign.currentQuestIndex];
                const questNumber = campaign.currentQuestIndex + 1;
                const totalQuests = campaign.quests.length;

                return (
                  <>
                    {/* Quest Image - Hero Position */}
                    {currentQuest.imageUrl && !currentQuest.imageGenerationFailed && (
                      <div className="relative -mx-6 mb-6 quest-image-hero overflow-hidden">
                        <img
                          src={currentQuest.imageUrl}
                          alt={currentQuest.title}
                          className="w-full h-full object-cover image-rendering-pixelated"
                          loading="lazy"
                        />
                        {/* Quest Number Badge */}
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          {/* Quest Type Badge */}
                          {currentQuest.questType && currentQuest.questType !== 'PHOTO' && (
                            <div className={`bg-black/80 border-2 px-2 py-1 rounded flex items-center gap-1 ${
                              currentQuest.questType === 'VIDEO' ? 'border-red-500 text-red-400' : 'border-purple-500 text-purple-400'
                            }`}>
                              {currentQuest.questType === 'VIDEO' ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                              <span className="font-pixel text-xs">{currentQuest.questType}</span>
                            </div>
                          )}
                          <div className="bg-black/80 border-2 border-adventure-gold px-3 py-1 rounded">
                            <span className="font-pixel text-adventure-gold text-xs">
                              {questNumber}/{totalQuests}
                            </span>
                          </div>
                        </div>
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
                      </div>
                    )}

                    {/* Image Loading/Failed State */}
                    {!currentQuest.imageUrl && (
                      <div className="relative -mx-6 mb-6 quest-image-hero overflow-hidden bg-zinc-900 flex items-center justify-center">
                        <div className="text-center py-12">
                          <div className="w-12 h-12 border-4 border-adventure-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                          <p className="text-xs font-pixel text-gray-500">LOADING IMAGE...</p>
                        </div>
                        {/* Quest Number Badge - still show even when loading */}
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                          {currentQuest.questType && currentQuest.questType !== 'PHOTO' && (
                            <div className={`bg-black/80 border-2 px-2 py-1 rounded flex items-center gap-1 ${
                              currentQuest.questType === 'VIDEO' ? 'border-red-500 text-red-400' : 'border-purple-500 text-purple-400'
                            }`}>
                              {currentQuest.questType === 'VIDEO' ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                              <span className="font-pixel text-xs">{currentQuest.questType}</span>
                            </div>
                          )}
                          <div className="bg-black/80 border-2 border-adventure-gold px-3 py-1 rounded">
                            <span className="font-pixel text-adventure-gold text-xs">
                              {questNumber}/{totalQuests}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quest Card */}
                    <div className="quest-card p-6 rounded-lg space-y-4 quest-card-corners">
                      {/* Quest Title */}
                      <div className="flex items-start gap-3">
                        <Compass className="w-6 h-6 text-adventure-gold flex-shrink-0 mt-1" />
                        <h2 className="text-xl font-pixel text-adventure-gold leading-tight flex-1" style={{ fontSize: '1rem' }}>
                          {currentQuest.title}
                        </h2>
                        {/* Location Info Button */}
                        {getCurrentLocationResearch() && (
                          <button
                            onClick={() => setShowLocationInfo(true)}
                            className="text-adventure-sky hover:text-white transition-colors flex-shrink-0"
                            aria-label="View location information"
                          >
                            <Info className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      {/* Narrative */}
                      <p className="text-sm font-sans text-emerald-200 leading-relaxed pl-9">
                        {currentQuest.narrative}
                      </p>

                      {/* Distance Info - only show static distance when GPS is disabled */}
                      {currentQuest.distanceFromPrevious && !gpsEnabled && (
                        <div className="flex items-center gap-4 pl-9 text-xs font-sans">
                          <div className="flex items-center gap-1.5 text-adventure-sky">
                            <Navigation className="w-4 h-4" />
                            <span>{formatDistance(currentQuest.distanceFromPrevious, unitSystem)} away</span>
                          </div>
                        </div>
                      )}

                      {/* Objective Box with Integrated Hint */}
                      <div className="bg-adventure-brown/20 border-2 border-adventure-brown rounded-lg p-4">
                        <p className="text-xs uppercase text-adventure-gold mb-1 font-pixel" style={{ fontSize: '0.6rem' }}>
                          OBJECTIVE
                        </p>
                        <p className="text-sm font-sans text-white mb-3">
                          {currentQuest.objective}
                        </p>

                        {/* Hint inside the box */}
                        <div className="flex items-start gap-2 pt-2 border-t border-adventure-brown/30">
                          <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs font-sans text-gray-400 italic">
                            {currentQuest.locationHint}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3 mt-6">
                        {/* GPS Distance Display */}
                        {gpsEnabled && (
                          <div className="bg-zinc-900/50 rounded-lg px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              {/* Distance to target */}
                              {permissionStatus === 'denied' ? (
                                <div className="flex items-center gap-2 text-xs font-sans text-red-400">
                                  <Navigation className="w-4 h-4" />
                                  <span>GPS: Permission denied</span>
                                </div>
                              ) : userGps && currentQuest.coordinates ? (
                                <div className="flex items-center gap-2 text-xs font-sans text-gray-300">
                                  <Navigation className="w-4 h-4 text-adventure-sky" />
                                  <span>
                                    Distance: {(() => {
                                      const R = 6371;
                                      const dLat = ((currentQuest.coordinates.lat - userGps.lat) * Math.PI) / 180;
                                      const dLng = ((currentQuest.coordinates.lng - userGps.lng) * Math.PI) / 180;
                                      const a = Math.sin(dLat / 2) ** 2 + Math.cos((userGps.lat * Math.PI) / 180) * Math.cos((currentQuest.coordinates.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
                                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                      const distanceKm = R * c;
                                      return formatDistance(distanceKm, unitSystem);
                                    })()}
                                  </span>
                                </div>
                              ) : gpsError ? (
                                <div className="flex items-center gap-2 text-xs font-sans text-red-400">
                                  <Navigation className="w-4 h-4" />
                                  <span>GPS: {gpsError.length > 20 ? 'Unavailable' : gpsError}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs font-sans text-gray-500">
                                  <Navigation className="w-4 h-4" />
                                  <span>Distance: waiting...</span>
                                </div>
                              )}
                              <button
                                onClick={async () => {
                                  setGpsRefreshFailed(false);
                                  const coords = await refreshLocation();
                                  if (coords) {
                                    setUserGps(coords);
                                  } else {
                                    setGpsRefreshFailed(true);
                                    // Auto-hide error after 3 seconds
                                    setTimeout(() => setGpsRefreshFailed(false), 3000);
                                  }
                                }}
                                disabled={isRefreshing || permissionStatus === 'denied'}
                                className="flex items-center gap-1.5 text-xs font-pixel text-adventure-sky hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {isRefreshing ? 'UPDATING...' : 'REFRESH'}
                              </button>
                            </div>
                            {/* GPS Error Feedback */}
                            {gpsRefreshFailed && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-xs text-red-400 font-sans bg-red-500/10 rounded px-2 py-1"
                              >
                                Could not refresh location. Try moving outdoors or check GPS permissions.
                              </motion.div>
                            )}
                            {permissionStatus === 'denied' && (
                              <div className="text-xs text-red-400 font-sans bg-red-500/10 rounded px-2 py-1">
                                GPS access denied. Enable location in your browser settings.
                              </div>
                            )}
                          </div>
                        )}

                        {/* View on Google Maps Button */}
                        {(currentQuest.coordinates || currentQuest.placeName || currentQuest.title) && (
                          <button
                            className="w-full border-2 border-adventure-sky text-adventure-sky font-pixel py-3 px-6 rounded-lg hover:bg-adventure-sky/10 transition-colors flex items-center justify-center gap-2"
                            onClick={() => viewQuestArea(currentQuest)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <ExternalLink className="w-4 h-4" />
                            OPEN IN GOOGLE MAPS
                          </button>
                        )}

                        {/* Scan/Record Button */}
                        <button
                          className={`w-full font-bold font-pixel py-4 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-pixel-lg ${
                            currentQuest.questType === 'VIDEO'
                              ? 'bg-red-500 text-white hover:bg-red-400'
                              : currentQuest.questType === 'AUDIO'
                              ? 'bg-purple-500 text-white hover:bg-purple-400'
                              : 'bg-adventure-emerald text-black hover:bg-adventure-gold'
                          }`}
                          onClick={() => setIsScanning(true)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          {currentQuest.questType === 'VIDEO' ? (
                            <>
                              <Video className="w-5 h-5" />
                              RECORD VIDEO
                            </>
                          ) : currentQuest.questType === 'AUDIO' ? (
                            <>
                              <Mic className="w-5 h-5" />
                              RECORD AUDIO
                            </>
                          ) : (
                            <>
                              <Camera className="w-5 h-5" />
                              SCAN LOCATION
                            </>
                          )}
                        </button>

                        {/* Dev Mode: Skip Quest Button */}
                        {process.env.NODE_ENV === 'development' && (
                          <button
                            className="w-full font-pixel py-2 px-4 rounded-lg border-2 border-dashed border-yellow-500/50 text-yellow-500/70 text-xs hover:bg-yellow-500/10 transition-colors"
                            onClick={() => {
                              setResult({ success: true, feedback: '[DEV] Quest skipped for testing' });
                              setIsVerifying(true);
                            }}
                          >
                            [DEV] SKIP QUEST
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Journey Stats Card */}
                    {journeyStats && journeyStats.pathPoints.length > 0 && (
                      <JourneyStatsCard journeyStats={journeyStats} unitSystem={unitSystem} />
                    )}

                    {/* Upcoming Quests Preview */}
                    {campaign.quests.length > 1 && campaign.currentQuestIndex < campaign.quests.length - 1 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-pixel text-zinc-500 flex items-center gap-2">
                          <span>UPCOMING QUESTS</span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </h3>
                        <div className="space-y-2">
                          {campaign.quests.slice(campaign.currentQuestIndex + 1, campaign.currentQuestIndex + 3).map((upcomingQuest, idx) => (
                            <QuestPreview
                              key={upcomingQuest.id}
                              quest={upcomingQuest}
                              questNumber={campaign.currentQuestIndex + 2 + idx}
                              totalQuests={totalQuests}
                              revealLevel={idx === 0 ? 'next' : 'hidden'}
                              unitSystem={unitSystem}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campaign Progress */}
                    {campaign.totalDistance && (
                      <div className="text-center text-xs font-sans text-gray-600 space-y-1">
                        <p>Total Campaign: {formatDistance(campaign.totalDistance, unitSystem)}</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Appeal Dialog */}
        {showAppealDialog && result && (
          <AppealDialog
            onSubmit={handleAppealSubmit}
            onCancel={() => setShowAppealDialog(false)}
            distanceFromTarget={result.distanceFromTarget || null}
            userGps={userGps}
            gpsAccuracy={gpsAccuracy}
            isSubmitting={isAppealing}
            unitSystem={unitSystem}
          />
        )}

        {/* Journey Map */}
        {showJourneyMap && journeyStats && campaign && (
          <JourneyMap
            journeyStats={journeyStats}
            quests={campaign.quests}
            campaignStartLocation={campaign.location}
            unitSystem={unitSystem}
            onClose={() => {
              setShowJourneyMap(false);

              // If campaign is complete, reset game
              if (campaign.currentQuestIndex >= campaign.quests.length - 1) {
                setCampaign(null);
                setResult(null);
                setIsVerifying(false);
                setLocation('');
                setDistanceRange(null);
                setGeocodedLocation(null);
                setGeocodeError(null);
                setCompletedQuests([]);
              }
            }}
          />
        )}

        {/* Location Info Modal */}
        {campaign && (
          <LocationInfoModal
            locationResearch={getCurrentLocationResearch()}
            isOpen={showLocationInfo}
            onClose={() => setShowLocationInfo(false)}
          />
        )}

        {/* Quest Book */}
        <QuestBook
          isOpen={showQuestBook}
          onClose={() => setShowQuestBook(false)}
          currentCampaign={campaign}
          currentQuestIndex={campaign?.currentQuestIndex || 0}
          campaignHistory={campaignHistory}
          completedQuests={completedQuests}
          unitSystem={unitSystem}
        />
      </div>
    </main>
  );
}
