'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Compass, Zap, Map, CheckCircle, XCircle, Camera, Video, Mic, Navigation, MessageSquare, ExternalLink, RefreshCw, Crosshair, BookOpen } from 'lucide-react';
import { generateCampaign, verifyMedia, verifyMediaWithAppeal } from '@/lib/game-logic';
import { geocodeLocation } from '@/lib/location';
import { generateQuestImage } from '@/lib/gemini';
import { Campaign, VerificationResult, DistanceRange, LocationData, Coordinates, AppealData, MediaCaptureData, XP_REWARDS, QuestType, CampaignOptions, StoredCampaign } from '@/types';
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
import XPHeader from '@/components/XPHeader';
import ThinkingPanel from '@/components/ThinkingPanel';
import {
  getCurrentCampaignId,
  loadCampaign,
  saveCampaign,
  clearCurrentCampaign,
  markCampaignComplete,
  addToHistory,
  getCampaignHistory,
  addXP
} from '@/lib/storage';
import { useSessionContext } from '@/hooks/useSessionContext';

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

  // Quest Book State
  const [showQuestBook, setShowQuestBook] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<StoredCampaign[]>([]);

  // XP State
  const [xpGain, setXpGain] = useState<{ amount: number; timestamp: number } | null>(null);

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
    resetContext: resetSessionContext
  } = useSessionContext({
    campaignId: campaign?.id || null,
    enabled: !!campaign
  });

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

  // Restore campaign on mount
  useEffect(() => {
    const checkForExistingCampaign = async () => {
      const activeCampaignId = await getCurrentCampaignId();
      if (activeCampaignId && !campaign) {
        const stored = await loadCampaign(activeCampaignId);
        if (stored && !stored.completedAt) {
          // Always show resume prompt - images will be loaded from Firebase or regenerated if missing
          setSavedCampaignId(activeCampaignId);
          setShowResumePrompt(true);
        }
      }
    };
    checkForExistingCampaign();
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

      try {
        console.log(`[App] Regenerating ${questsNeedingImages.length} quest images in parallel...`);

        // Regenerate images in parallel for faster loading
        const imagePromises = questsNeedingImages.map(async (quest) => {
          try {
            const imageUrl = await generateQuestImage(quest);
            return { questId: quest.id, imageUrl: imageUrl || undefined };
          } catch (error) {
            console.error(`[App] Failed to regenerate image for quest ${quest.id}:`, error);
            return { questId: quest.id, imageUrl: undefined };
          }
        });

        const results = await Promise.all(imagePromises);

        // Apply the regenerated images to quests
        for (const result of results) {
          const quest = stored.campaign.quests.find(q => q.id === result.questId);
          if (quest) {
            quest.imageUrl = result.imageUrl;
          }
        }
      } catch (error) {
        console.error('[App] Failed to regenerate images:', error);
      } finally {
        setIsLoading(false);
        setIsResuming(false);
      }
    }

    // Restore campaign (with existing or regenerated images)
    setCampaign(stored.campaign);
    setCompletedQuests(stored.progress.completedQuests);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Restore journey stats if available
    if (stored.journeyStats) {
      resetWithStats(stored.journeyStats);
      console.log('[App] Restored journey stats from storage');
    }

    setSavedCampaignId(null);
    console.log('[App] Resumed campaign from storage');
  };

  // Rotating messages for different loading states
  const RESUME_MESSAGES = [
    "RESTORING YOUR ADVENTURE...",
    "LOADING QUEST DATA...",
    "REGENERATING QUEST IMAGES...",
    "PREPARING YOUR JOURNEY..."
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
    "SCANNING VISUAL DATA...",
    "ANALYZING COMPOSITION...",
    "CHECKING QUEST CRITERIA...",
    "CONSULTING THE AI ORACLE...",
    "EVALUATING YOUR SUBMISSION...",
    "CROSS-REFERENCING OBJECTIVES..."
  ];

  const handleDeclineResume = async () => {
    if (savedCampaignId) {
      await clearCurrentCampaign();
    }
    setShowResumePrompt(false);
    setSavedCampaignId(null);
  };

  const startAdventure = async (type: 'short' | 'long') => {
    if (!geocodedLocation || !distanceRange) return;

    // Clear any previous campaign and session context
    await clearCurrentCampaign();
    setCompletedQuests([]);
    resetSessionContext();

    setIsLoading(true);
    try {
      // Always use guaranteed mix mode: 1 photo, 1 video, 1 audio quest
      const campaignOptions: CampaignOptions = {
        enableVideoQuests: true,
        enableAudioQuests: true,
        guaranteedMix: true
      };

      // Use geocodedLocation.name to pass to generateCampaign (which will geocode again)
      // The function will re-geocode, but we've already confirmed the location is valid
      const newCampaign = await generateCampaign(geocodedLocation.name, type, distanceRange, campaignOptions);
      setCampaign(newCampaign);
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
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize adventure.';
      alert(`Error: ${errorMessage}\n\nPlease check your API keys and try again.`);
    } finally {
      setIsLoading(false);
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

      console.log('[Verification] GPS for verification:', {
        fresh: !!freshGps,
        coords: verificationGps ? `${verificationGps.lat.toFixed(6)}, ${verificationGps.lng.toFixed(6)}` : 'none',
        accuracy: verificationAccuracy ? `±${verificationAccuracy.toFixed(0)}m` : 'unknown'
      });

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
        distanceFromTarget: verification.distanceFromTarget
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
    } catch (error) {
      console.error(error);
      alert('Verification failed. The satellite signal was lost.');
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
        distanceFromTarget: result?.distanceFromTarget
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
    } catch (error) {
      console.error(error);
      alert('Appeal failed. Please try again.');
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

    // Award XP based on quest difficulty
    const xpAmount = XP_REWARDS[currentQuest.difficulty] || XP_REWARDS.medium;
    addXP(xpAmount);
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
      addToHistory(campaign.id);

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

  // Open quest location on Google Maps - prefer place name over coordinates
  const viewQuestArea = (quest: { coordinates?: Coordinates; placeName?: string; title?: string }) => {
    let searchQuery: string | null = null;

    // Priority 1: Use actual place name from Places API
    if (quest.placeName) {
      searchQuery = quest.placeName;
    }
    // Priority 2: Use quest title (usually contains the place name)
    else if (quest.title) {
      searchQuery = quest.title;
    }

    // Build URL
    let url: string;
    if (searchQuery) {
      // Search by name - Google Maps will find the exact location
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
    } else if (quest.coordinates) {
      // Fallback: use coordinates
      url = `https://www.google.com/maps/search/?api=1&query=${quest.coordinates.lat},${quest.coordinates.lng}`;
    } else {
      return; // No location data available
    }

    window.open(url, '_blank');
  };

  return (
    <main className="min-h-screen bg-black text-emerald-400 p-6 selection:bg-emerald-900 selection:text-emerald-100">
      {/* Fixed Header Buttons */}
      {campaign && (
        <>
          {/* XP Header - Fixed Position Left */}
          <div className="fixed top-4 left-4 z-40">
            <XPHeader onXPGain={xpGain} />
          </div>

          {/* Quest Book Button - Fixed Position Right */}
          <button
            onClick={() => setShowQuestBook(true)}
            className="fixed top-4 right-4 z-40 w-14 h-14 bg-black/90 rounded-full border border-adventure-gold/30 shadow-lg hover:border-adventure-gold hover:bg-black transition-colors flex items-center justify-center"
            aria-label="Open Quest Book"
          >
            <BookOpen className="w-6 h-6 text-adventure-gold" />
          </button>
        </>
      )}

      <div className="max-w-md mx-auto pt-20 pb-20">
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
                          STARTING_LOCATION
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
              />

              {/* Campaign Type Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-pixel text-adventure-gold">
                  CAMPAIGN_TYPE
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
                  <LoadingProgress
                    message={isResuming ? "RESTORING YOUR ADVENTURE..." : "GENERATING YOUR ADVENTURE..."}
                    subMessage={isResuming ? "Loading your saved progress" : "Creating quests with Gemini 3"}
                    rotatingMessages={isResuming ? RESUME_MESSAGES : GENERATE_MESSAGES}
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

                    {/* Quest Card */}
                    <div className="quest-card p-6 rounded-lg space-y-4 quest-card-corners">
                      {/* Quest Title */}
                      <div className="flex items-start gap-3">
                        <Compass className="w-6 h-6 text-adventure-gold flex-shrink-0 mt-1" />
                        <h2 className="text-xl font-pixel text-adventure-gold leading-tight" style={{ fontSize: '1rem' }}>
                          {currentQuest.title}
                        </h2>
                      </div>

                      {/* Narrative */}
                      <p className="text-sm font-sans text-emerald-200 leading-relaxed pl-9">
                        {currentQuest.narrative}
                      </p>

                      {/* Distance Info */}
                      {currentQuest.distanceFromPrevious && (
                        <div className="flex items-center gap-4 pl-9 text-xs font-sans">
                          <div className="flex items-center gap-1.5 text-adventure-sky">
                            <Navigation className="w-4 h-4" />
                            <span>{currentQuest.distanceFromPrevious.toFixed(1)}km away</span>
                          </div>
                        </div>
                      )}

                      {/* Objective Box */}
                      <div className="bg-adventure-brown/20 border-2 border-adventure-brown rounded-lg p-4">
                        <p className="text-xs uppercase text-adventure-gold mb-1 font-pixel" style={{ fontSize: '0.6rem' }}>
                          OBJECTIVE
                        </p>
                        <p className="text-sm font-sans text-white">
                          {currentQuest.objective}
                        </p>
                      </div>

                      {/* Location Hint */}
                      <div className="pl-9 text-xs font-sans text-gray-400 italic">
                        <MapPin className="w-3.5 h-3.5 inline mr-1" />
                        {currentQuest.locationHint}
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-3 mt-6">
                        {/* GPS Status Display */}
                        {gpsEnabled && (
                          <div className="bg-zinc-900/50 rounded-lg px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Crosshair className={`w-4 h-4 ${
                                  permissionStatus === 'denied' ? 'text-red-500' :
                                  gpsAccuracy && gpsAccuracy <= 30 ? 'text-green-500' :
                                  gpsAccuracy && gpsAccuracy <= 100 ? 'text-yellow-500' :
                                  'text-red-500'
                                }`} />
                                <div className="text-xs font-sans">
                                  {permissionStatus === 'denied' ? (
                                    <span className="text-red-400">GPS: Permission denied</span>
                                  ) : gpsAccuracy ? (
                                    <span className={
                                      gpsAccuracy <= 30 ? 'text-green-400' :
                                      gpsAccuracy <= 100 ? 'text-yellow-400' :
                                      'text-red-400'
                                    }>
                                      GPS: ±{gpsAccuracy.toFixed(0)}m
                                    </span>
                                  ) : gpsError ? (
                                    <span className="text-red-400">GPS: {gpsError.length > 20 ? 'Unavailable' : gpsError}</span>
                                  ) : (
                                    <span className="text-gray-500">GPS: waiting...</span>
                                  )}
                                </div>
                              </div>
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
                      </div>
                    </div>

                    {/* Journey Stats Card */}
                    {journeyStats && journeyStats.pathPoints.length > 0 && (
                      <JourneyStatsCard journeyStats={journeyStats} />
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
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campaign Progress */}
                    {campaign.totalDistance && (
                      <div className="text-center text-xs font-sans text-gray-600 space-y-1">
                        <p>Total Campaign: {campaign.totalDistance.toFixed(1)}km</p>
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
          />
        )}

        {/* Journey Map */}
        {showJourneyMap && journeyStats && campaign && (
          <JourneyMap
            journeyStats={journeyStats}
            quests={campaign.quests}
            campaignStartLocation={campaign.location}
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

        {/* Quest Book */}
        <QuestBook
          isOpen={showQuestBook}
          onClose={() => setShowQuestBook(false)}
          currentCampaign={campaign}
          currentQuestIndex={campaign?.currentQuestIndex || 0}
          campaignHistory={campaignHistory}
          completedQuests={completedQuests}
        />
      </div>
    </main>
  );
}
