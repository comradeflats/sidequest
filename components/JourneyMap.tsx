'use client';

import { JourneyStats, Quest } from '@/types';
import { Map as MapIcon, TrendingUp, Clock, ExternalLink } from 'lucide-react';

interface JourneyMapProps {
  journeyStats: JourneyStats;
  quests: Quest[];
  campaignStartLocation?: string; // User's original location input
  onClose: () => void;
}

export default function JourneyMap({
  journeyStats,
  quests,
  campaignStartLocation,
  onClose
}: JourneyMapProps) {
  // Generate Google Maps URL showing all quest locations
  const generateGoogleMapsUrl = () => {
    if (quests.length === 0) return '';

    // Use quest locations to build the map, since those are the actual destinations
    const questsWithCoords = quests.filter(q => q.coordinates);

    if (questsWithCoords.length === 0) return '';

    if (questsWithCoords.length === 1) {
      // Single quest - just show the location
      const quest = questsWithCoords[0];
      return `https://www.google.com/maps/search/?api=1&query=${quest.coordinates!.lat},${quest.coordinates!.lng}`;
    }

    // Multiple quests - show as multi-stop route
    const firstQuest = questsWithCoords[0];
    const lastQuest = questsWithCoords[questsWithCoords.length - 1];

    // Use campaignStartLocation if available, otherwise use first quest
    const origin = campaignStartLocation
      ? encodeURIComponent(campaignStartLocation)
      : `${firstQuest.coordinates!.lat},${firstQuest.coordinates!.lng}`;

    const destination = `${lastQuest.coordinates!.lat},${lastQuest.coordinates!.lng}`;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;

    // Add middle quests as waypoints
    if (questsWithCoords.length > 2) {
      const middleQuests = questsWithCoords.slice(1, -1);
      const waypoints = middleQuests
        .map(q => `${q.coordinates!.lat},${q.coordinates!.lng}`)
        .join('|');
      url += `&waypoints=${waypoints}`;
    }

    return url;
  };

  const openInGoogleMaps = () => {
    const url = generateGoogleMapsUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 border-2 border-adventure-gold rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b-2 border-adventure-gold p-6">
          <div className="flex items-center gap-3 mb-2">
            <MapIcon className="w-6 h-6 text-adventure-gold" />
            <h2 className="text-xl font-pixel text-adventure-gold" style={{ fontSize: '1rem' }}>
              JOURNEY COMPLETE!
            </h2>
          </div>
          <p className="text-sm text-gray-400 font-sans">
            You are a master explorer! 🎉
          </p>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <TrendingUp className="w-5 h-5 text-adventure-emerald mx-auto mb-1" />
              <p className="text-2xl font-pixel text-white">
                {journeyStats.totalDistanceTraveled.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 font-sans">km traveled</p>
            </div>
            <div className="text-center">
              <Clock className="w-5 h-5 text-adventure-sky mx-auto mb-1" />
              <p className="text-2xl font-pixel text-white">
                {journeyStats.durationMinutes}
              </p>
              <p className="text-xs text-gray-400 font-sans">minutes</p>
            </div>
            <div className="text-center">
              <MapIcon className="w-5 h-5 text-adventure-gold mx-auto mb-1" />
              <p className="text-2xl font-pixel text-white">
                {quests.length}
              </p>
              <p className="text-xs text-gray-400 font-sans">quests</p>
            </div>
          </div>

          {/* Quest List */}
          <div className="bg-black/30 border-2 border-adventure-brown rounded-lg p-4">
            <p className="text-xs uppercase text-adventure-gold mb-2 font-pixel">
              QUESTS COMPLETED
            </p>
            <div className="space-y-2">
              {quests.map((quest, index) => (
                <div key={quest.id} className="flex items-center gap-2 text-sm">
                  <span className="text-adventure-emerald font-pixel">
                    {index + 1}.
                  </span>
                  <span className="text-gray-300 font-sans">{quest.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            {/* Open in Google Maps */}
            <button
              onClick={openInGoogleMaps}
              className="w-full bg-adventure-emerald text-black font-bold font-pixel py-4 px-6 rounded-lg hover:bg-adventure-gold transition-colors flex items-center justify-center gap-2"
              style={{ fontSize: '0.85rem' }}
            >
              <ExternalLink className="w-5 h-5" />
              VIEW IN GOOGLE MAPS
            </button>

            {/* Close / New Adventure */}
            <button
              onClick={onClose}
              className="w-full border-2 border-gray-600 text-gray-400 font-pixel py-4 px-6 rounded-lg hover:bg-gray-600/10 transition-colors"
              style={{ fontSize: '0.85rem' }}
            >
              START NEW ADVENTURE
            </button>
          </div>

          <p className="text-xs text-center text-gray-500 font-sans">
            Opens Google Maps with walking directions through all {quests.length} quest locations
          </p>
        </div>
      </div>
    </div>
  );
}
