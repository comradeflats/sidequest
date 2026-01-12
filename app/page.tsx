'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Compass, Zap, Map, CheckCircle, XCircle, Camera, Navigation } from 'lucide-react';
import { generateCampaign, verifyPhoto } from '@/lib/game-logic';
import { geocodeLocation } from '@/lib/location';
import { Campaign, VerificationResult, DistanceRange, LocationData } from '@/types';
import Scanner from '@/components/Scanner';
import DistanceRangeSelector from '@/components/DistanceRangeSelector';

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

  const startAdventure = async (type: 'short' | 'long') => {
    if (!geocodedLocation || !distanceRange) return;

    setIsLoading(true);
    try {
      // Use geocodedLocation.name to pass to generateCampaign (which will geocode again)
      // The function will re-geocode, but we've already confirmed the location is valid
      const newCampaign = await generateCampaign(geocodedLocation.name, type, distanceRange);
      setCampaign(newCampaign);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message || 'Failed to initialize adventure.';
      alert(`Error: ${errorMessage}\n\nPlease check your API keys and try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async (imageSrc: string) => {
    setIsScanning(false);
    setIsVerifying(true);

    if (!campaign) return;

    const currentQuest = campaign.quests[campaign.currentQuestIndex];

    try {
      const verification = await verifyPhoto(
        imageSrc,
        currentQuest.objective,
        currentQuest.secretCriteria
      );
      setResult(verification);
    } catch (error) {
      console.error(error);
      alert('Verification failed. The satellite signal was lost.');
      setIsVerifying(false);
    }
  };

  const nextQuest = () => {
    if (!campaign) return;

    const nextIndex = campaign.currentQuestIndex + 1;
    if (nextIndex < campaign.quests.length) {
      setCampaign({ ...campaign, currentQuestIndex: nextIndex });
      setResult(null);
      setIsVerifying(false);
    } else {
      const completionMessage = campaign.totalDistance
        ? `Campaign Complete!\n\nYou traveled ${campaign.totalDistance.toFixed(1)}km in ~${campaign.estimatedTotalTime} minutes.\n\nYou are a master explorer!`
        : 'Campaign Complete! You are a master explorer!';

      alert(completionMessage);

      // Reset game
      setCampaign(null);
      setResult(null);
      setIsVerifying(false);
      setLocation('');
      setDistanceRange(null);
      setGeocodedLocation(null);
      setGeocodeError(null);
    }
  };

  const retryQuest = () => {
    setResult(null);
    setIsVerifying(false);
  };

  return (
    <main className="min-h-screen bg-black text-emerald-400 p-6 selection:bg-emerald-900 selection:text-emerald-100">
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
                <div className="text-center space-y-4 py-8">
                  <div className="w-14 h-14 border-4 border-adventure-emerald border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="animate-pulse font-pixel text-sm text-adventure-gold">
                    GENERATING...
                  </p>
                  <p className="text-adventure-brown text-xs font-sans">
                    Creating your adventure with AI...
                  </p>
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
                <>
                  <div className="w-16 h-16 border-4 border-adventure-emerald border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="animate-pulse font-pixel text-sm text-adventure-gold">
                    ANALYZING...
                  </p>
                </>
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
                    <button
                      onClick={retryQuest}
                      className="w-full border-2 border-red-500 text-red-400 font-bold font-pixel py-4 px-6 rounded-lg hover:bg-red-500/10 transition-colors"
                      style={{ fontSize: '0.85rem' }}
                    >
                      RETRY
                    </button>
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
                      <div className="relative -mx-6 mb-6">
                        <div className="quest-image-hero overflow-hidden">
                          <img
                            src={currentQuest.imageUrl}
                            alt={currentQuest.title}
                            className="w-full h-full object-cover image-rendering-pixelated"
                          />

                          {/* Quest Number Badge */}
                          <div className="absolute top-4 right-4 bg-black/80 border-2 border-adventure-gold px-3 py-1 rounded">
                            <span className="font-pixel text-adventure-gold text-xs">
                              {questNumber}/{totalQuests}
                            </span>
                          </div>

                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50 pointer-events-none" />
                        </div>
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

                      {/* Scan Button */}
                      <button
                        className="w-full bg-adventure-emerald text-black font-bold font-pixel py-4 px-6 rounded-lg hover:bg-adventure-gold transition-colors flex items-center justify-center gap-2 shadow-pixel-lg mt-6"
                        onClick={() => setIsScanning(true)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <Camera className="w-5 h-5" />
                        SCAN LOCATION
                      </button>
                    </div>

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
      </div>
    </main>
  );
}
