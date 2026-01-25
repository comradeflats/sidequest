'use client';

import { JourneyStats } from '@/types';
import { formatDistance } from '@/lib/units';
import { TrendingUp, Clock } from 'lucide-react';

interface JourneyStatsCardProps {
  journeyStats: JourneyStats | null;
  unitSystem?: 'metric' | 'imperial';
}

export default function JourneyStatsCard({
  journeyStats,
  unitSystem = 'metric'
}: JourneyStatsCardProps) {
  if (!journeyStats) return null;

  return (
    <div className="bg-zinc-900 border-2 border-adventure-sky rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-center text-adventure-sky">
          Journey Tracker
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <TrendingUp className="w-4 h-4 text-adventure-emerald mx-auto mb-1" />
          <p className="text-xl font-bold tabular-nums text-white">
            {formatDistance(journeyStats.totalDistanceTraveled, unitSystem)}
          </p>
          <p className="text-xs font-medium uppercase text-gray-500">distance</p>
        </div>
        <div className="text-center">
          <Clock className="w-4 h-4 text-adventure-sky mx-auto mb-1" />
          <p className="text-xl font-bold tabular-nums text-white">
            {journeyStats.durationMinutes}
          </p>
          <p className="text-xs font-medium uppercase text-gray-500">min</p>
        </div>
      </div>
    </div>
  );
}
