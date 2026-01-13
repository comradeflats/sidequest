'use client';

import { JourneyStats } from '@/types';
import { TrendingUp, Clock, MapPin } from 'lucide-react';

interface JourneyStatsCardProps {
  journeyStats: JourneyStats | null;
}

export default function JourneyStatsCard({
  journeyStats
}: JourneyStatsCardProps) {
  if (!journeyStats) return null;

  return (
    <div className="bg-zinc-900 border-2 border-adventure-sky rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-sm font-pixel text-adventure-sky">
          JOURNEY_TRACKER
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <TrendingUp className="w-4 h-4 text-adventure-emerald mx-auto mb-1" />
          <p className="text-lg font-pixel text-white">
            {journeyStats.totalDistanceTraveled.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 font-sans">km</p>
        </div>
        <div className="text-center">
          <Clock className="w-4 h-4 text-adventure-sky mx-auto mb-1" />
          <p className="text-lg font-pixel text-white">
            {journeyStats.durationMinutes}
          </p>
          <p className="text-xs text-gray-500 font-sans">min</p>
        </div>
        <div className="text-center">
          <MapPin className="w-4 h-4 text-adventure-gold mx-auto mb-1" />
          <p className="text-lg font-pixel text-white">
            {journeyStats.pathPoints.length}
          </p>
          <p className="text-xs text-gray-500 font-sans">pts</p>
        </div>
      </div>
    </div>
  );
}
