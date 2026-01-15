'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Compass, Zap, Map, CheckCircle, XCircle, Camera, Navigation, MessageSquare, ExternalLink, RefreshCw, Crosshair } from 'lucide-react';
import { generateCampaign, verifyPhoto, verifyPhotoWithAppeal } from '@/lib/game-logic';
import { geocodeLocation } from '@/lib/location';
import { generateQuestImage } from '@/lib/gemini';
import { Campaign, VerificationResult, DistanceRange, LocationData, Coordinates, AppealData, MediaCaptureData } from '@/types';
import { trackEvent } from '@/lib/analytics';
import Scanner from '@/components/Scanner';
import DistanceRangeSelector from '@/components/DistanceRangeSelector';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useJourneyTracking } from '@/hooks/useJourneyTracking';
import AppealDialog from '@/components/AppealDialog';
import JourneyMap from '@/components/JourneyMap';
import JourneyStatsCard from '@/components/JourneyStatsCard';
import QuestBook from '@/components/QuestBook';
import LoadingProgress from '@/components/LoadingProgress';
import {
  getCurrentCampaignId,
  loadCampaign,
  saveCampaign,
  clearCurrentCampaign,
  markCampaignComplete,
  addToHistory,
  getCampaignHistory
} from '@/lib/storage';

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
  const [lastVerificationImage, setLastVerificationImage] = useState<string | null>(null);
  const [isAppealing, setIsAppealing] = useState(false);

  // Journey Tracking State
  const [showJourneyMap, setShowJourneyMap] = useState(false);

  // Campaign Persistence State
  const [completedQuests, setCompletedQuests] = useState<string[]>([]);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);

  // Quest Book State
  const [showQuestBook, setShowQuestBook] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<any[]>([]);

  // Initialize GPS tracking hook
  const geoState = useGeolocation(gpsEnabled);
  const { refreshLocation, isRefreshing } = geoState;

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
    const activeCampaignId = getCurrentCampaignId();
    if (activeCampaignId && !campaign) {
      const stored = loadCampaign(activeCampaignId);
      if (stored && !stored.completedAt) {
        // Show resume prompt
        setSavedCampaignId(activeCampaignId);
        setShowResumePrompt(true);
      }
    }
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
    const history = getCampaignHistory();
    setCampaignHistory(history);
  }, [campaign]); // Refresh when campaign changes (e.g., completion)

  const handleGeocodeLocation = async () => {
    if (!location.trim()) return;

    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const locationData = await geocodeLocation(location);
      setGeocodedLocation(locationData);
    } catch (error: any) {
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

    const stored = loadCampaign(savedCampaignId);
    if (!stored) return;

    // Check if images need to be regenerated
    const questsNeedingImages = stored.campaign.quests.filter(q => !q.imageUrl);

    if (questsNeedingImages.length > 0) {
      setIsLoading(true);
      console.log(`[App] Regenerating ${questsNeedingImages.length} quest images...`);

      // Regenerate missing images
      for (const quest of questsNeedingImages) {
        try {
          const imageUrl = await generateQuestImage(quest);
          quest.imageUrl = imageUrl || undefined;
        } catch (error) {
          console.error(`[App] Failed to regenerate image for quest ${quest.id}:`, error);
          quest.imageUrl = undefined;
        }
      }

      setIsLoading(false);
    }

    // Restore campaign with regenerated images
    setCampaign(stored.campaign);
    setCompletedQuests(stored.progress.completedQuests);

    // Restore journey stats if available
    if (stored.journeyStats) {
      resetWithStats(stored.journeyStats);
      console.log('[App] Restored journey stats from storage');
    }

    setShowResumePrompt(false);
    setSavedCampaignId(null);
    console.log('[App] Resumed campaign from storage');
  };

  const handleDeclineResume = () => {
    if (savedCampaignId) {
      clearCurrentCampaign();
    }
    setShowResumePrompt(false);
    setSavedCampaignId(null);
  };

  const startAdventure = async (type: 'short' | 'long') => {
    if (!geocodedLocation || !distanceRange) return;

    // Clear any previous campaign
    clearCurrentCampaign();
    setCompletedQuests([]);

    setIsLoading(true);
    try {
      // Use geocodedLocation.name to pass to generateCampaign (which will geocode again)
      // The function will re-geocode, but we've already confirmed the location is valid
      const newCampaign = await generateCampaign(geocodedLocation.name, type, distanceRange);
      setCampaign(newCampaign);

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
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'Failed to initialize adventure.';
      alert(`Error: ${errorMessage}\n\nPlease check your API keys and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async (captureData: MediaCaptureData) => {
    setIsScanning(false);
    setIsVerifying(true);
    setLastVerificationImage(captureData.data); // Store for potential appeal

    if (!campaign) return;

    const currentQuest = campaign.quests[campaign.currentQuestIndex];

    try {
      // Track verification attempt
      trackEvent({
        name: 'verification_attempt',
        params: {
          quest_id: currentQuest.id,
          quest_index: campaign.currentQuestIndex,
          media_type: 'photo'
        }
      });

      // Verify the photo
      const verification = await verifyPhoto(
        captureData.data,
        currentQuest.objective,
        currentQuest.secretCriteria,
        userGps || undefined,
        currentQuest.coordinates
      );

      setResult(verification);

      // Track verification result
      if (verification.success) {
        trackEvent({
          name: 'verification_success',
          params: {
            quest_id: currentQuest.id,
            quest_index: campaign.currentQuestIndex,
            media_type: 'photo'
          }
        });
      } else {
        trackEvent({
          name: 'verification_failure',
          params: {
            quest_id: currentQuest.id,
            quest_index: campaign.currentQuestIndex,
            appealable: verification.appealable || false,
            media_type: 'photo'
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
    if (!campaign || !lastVerificationImage) return;

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
          gps_distance: appealData.distanceFromTarget
        }
      });

      const appealResult = await verifyPhotoWithAppeal(
        lastVerificationImage,
        currentQuest.objective,
        currentQuest.secretCriteria,
        appealData,
        currentQuest.coordinates!
      );

      // Convert AppealResult to VerificationResult
      setResult({
        success: appealResult.success,
        feedback: appealResult.feedback,
        reasoning: appealResult.reasoning
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

  const nextQuest = () => {
    if (!campaign) return;

    // Mark quest as complete in journey
    markQuestComplete();

    // Add current quest to completed list
    const currentQuest = campaign.quests[campaign.currentQuestIndex];
    setCompletedQuests(prev => [...prev, currentQuest.id]);

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
    } else {
      // Campaign complete! Mark it and add to history
      markCampaignComplete(campaign.id);
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

  // Open quest area on Google Maps (with fuzzy location)
  const viewQuestArea = (coordinates: Coordinates) => {
    // Add random offset to coordinates (25-50 meters in random direction)
    const offsetMeters = 25 + Math.random() * 25; // 25-50m offset
    const angle = Math.random() * 2 * Math.PI; // Random direction

    // Convert meters to degrees (rough approximation)
    const latOffset = (offsetMeters / 111320) * Math.cos(angle);
    const lngOffset = (offsetMeters / (111320 * Math.cos(coordinates.lat * Math.PI / 180))) * Math.sin(angle);

    const fuzzedLat = coordinates.lat + latOffset;
    const fuzzedLng = coordinates.lng + lngOffset;

    // Open Google Maps at zoomed out level showing the general area
    // Zoom level 16 shows neighborhood, 17 shows blocks
    const url = `https://www.google.com/maps/@${fuzzedLat},${fuzzedLng},16z`;
    window.open(url, '_blank');
  };

  return (
    <main className="min-h-screen bg-black text-emerald-400 p-6 selection:bg-emerald-900 selection:text-emerald-100">
      {/* Quest Book Button - Fixed Position */}
      {campaign && (
        <button
          onClick={() => setShowQuestBook(true)}
          className="fixed top-4 right-4 z-40 bg-adventure-gold text-black px-4 py-2 rounded-lg shadow-lg hover:bg-yellow-500 transition-colors flex items-center gap-2 font-pixel text-sm"
        >
          <MapPin className="w-4 h-4" />
          QUEST BOOK
        </button>
      )}

      <div className="max-w-md mx-auto pt-12 pb-20">
        <header className="mb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-pixel text-adventure-gold mb-3 drop-shadow-lg"
            style={{ fontSize: '2rem', lineHeight: '1.4' }}
          >
            GEOSEEKER
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
          {isScanning && (
            <Scanner
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
                    <Map className="w-8 h-8 mb-3 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold font-pixel" style={{ fontSize: '0.7rem' }}>
                      CITY ODYSSEY
                    </span>
                    <span className="text-xs text-gray-500 mt-1 font-sans">4-5 quests</span>
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <LoadingProgress
                  message="GENERATING YOUR ADVENTURE..."
                  subMessage="Creating quests with Gemini 3"
                />
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
                  subMessage="Gemini is verifying your photo"
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
                      "{result.feedback}"
                    </p>
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
                        TAKE NEW PHOTO
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
                        <div className="absolute top-4 right-4 bg-black/80 border-2 border-adventure-gold px-3 py-1 rounded z-10">
                          <span className="font-pixel text-adventure-gold text-xs">
                            {questNumber}/{totalQuests}
                          </span>
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

                      {/* Distance & Duration Info */}
                      {currentQuest.distanceFromPrevious && currentQuest.estimatedDuration && (
                        <div className="flex items-center gap-4 pl-9 text-xs font-sans">
                          <div className="flex items-center gap-1.5 text-adventure-sky">
                            <Navigation className="w-4 h-4" />
                            <span>{currentQuest.distanceFromPrevious.toFixed(1)}km away</span>
                          </div>
                          <div className="text-gray-500">
                            ~{currentQuest.estimatedDuration} min
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
                          <div className="flex items-center justify-between bg-zinc-900/50 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Crosshair className={`w-4 h-4 ${
                                gpsAccuracy && gpsAccuracy <= 30 ? 'text-green-500' :
                                gpsAccuracy && gpsAccuracy <= 100 ? 'text-yellow-500' :
                                'text-red-500'
                              }`} />
                              <div className="text-xs font-sans">
                                {gpsAccuracy ? (
                                  <span className={
                                    gpsAccuracy <= 30 ? 'text-green-400' :
                                    gpsAccuracy <= 100 ? 'text-yellow-400' :
                                    'text-red-400'
                                  }>
                                    GPS: ±{gpsAccuracy.toFixed(0)}m
                                  </span>
                                ) : (
                                  <span className="text-gray-500">GPS: waiting...</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                const coords = await refreshLocation();
                                if (coords) {
                                  setUserGps(coords);
                                }
                              }}
                              disabled={isRefreshing}
                              className="flex items-center gap-1.5 text-xs font-pixel text-adventure-sky hover:text-white transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                              {isRefreshing ? 'UPDATING...' : 'REFRESH'}
                            </button>
                          </div>
                        )}

                        {/* View Area Button */}
                        {currentQuest.coordinates && (
                          <button
                            className="w-full border-2 border-adventure-sky text-adventure-sky font-pixel py-3 px-6 rounded-lg hover:bg-adventure-sky/10 transition-colors flex items-center justify-center gap-2"
                            onClick={() => viewQuestArea(currentQuest.coordinates!)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <ExternalLink className="w-4 h-4" />
                            VIEW AREA ON MAP
                          </button>
                        )}

                        {/* Scan Button */}
                        <button
                          className="w-full bg-adventure-emerald text-black font-bold font-pixel py-4 px-6 rounded-lg hover:bg-adventure-gold transition-colors flex items-center justify-center gap-2 shadow-pixel-lg"
                          onClick={() => setIsScanning(true)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          <Camera className="w-5 h-5" />
                          SCAN LOCATION
                        </button>
                      </div>
                    </div>

                    {/* Journey Stats Card */}
                    {journeyStats && journeyStats.pathPoints.length > 0 && (
                      <JourneyStatsCard journeyStats={journeyStats} />
                    )}

                    {/* Campaign Progress */}
                    {campaign.totalDistance && campaign.estimatedTotalTime && (
                      <div className="text-center text-xs font-sans text-gray-600 space-y-1">
                        <p>Total Campaign: {campaign.totalDistance.toFixed(1)}km • ~{campaign.estimatedTotalTime} min walking</p>
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
