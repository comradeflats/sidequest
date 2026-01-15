import { useState, useEffect, useCallback, useRef } from 'react';
import { Coordinates, JourneyPoint, JourneyStats } from '@/types';

const MIN_DISTANCE_METERS = 20; // Only record if moved 20m+
const MIN_TIME_SECONDS = 30; // Or at least 30 seconds passed
const MAX_ACCURACY_METERS = 50; // Ignore points with poor accuracy

interface UseJourneyTrackingProps {
  enabled: boolean;
  currentQuestIndex: number;
  initialStats?: JourneyStats | null;
  onJourneyUpdate?: (stats: JourneyStats) => void;
}

export function useJourneyTracking({
  enabled,
  currentQuestIndex,
  initialStats,
  onJourneyUpdate
}: UseJourneyTrackingProps) {
  const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(initialStats || null);
  const lastRecordedPoint = useRef<JourneyPoint | null>(null);
  const lastRecordedTime = useRef<number>(0);
  const hasInitialized = useRef(false);

  // Initialize journey when tracking starts (only if no initial stats provided)
  useEffect(() => {
    if (enabled && !journeyStats && !hasInitialized.current) {
      hasInitialized.current = true;
      const newStats: JourneyStats = {
        totalDistanceTraveled: 0,
        startTime: new Date(),
        durationMinutes: 0,
        pathPoints: [],
        questCompletionTimes: []
      };
      setJourneyStats(newStats);
    }
  }, [enabled, journeyStats]);

  // Allow external initialization (for resume)
  useEffect(() => {
    if (initialStats && !journeyStats) {
      setJourneyStats(initialStats);
      // Restore last recorded point from path history
      if (initialStats.pathPoints.length > 0) {
        const lastPoint = initialStats.pathPoints[initialStats.pathPoints.length - 1];
        lastRecordedPoint.current = lastPoint;
        lastRecordedTime.current = new Date(lastPoint.timestamp).getTime();
      }
      hasInitialized.current = true;
    }
  }, [initialStats, journeyStats]);

  // Calculate distance between two points (Haversine)
  const calculateDistance = useCallback((
    point1: Coordinates,
    point2: Coordinates
  ): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }, []);

  // Add a new point to the journey
  const recordPoint = useCallback((
    coordinates: Coordinates,
    accuracy: number
  ) => {
    if (!enabled || !journeyStats) return;

    // Ignore points with poor accuracy
    if (accuracy > MAX_ACCURACY_METERS) {
      console.log('[Journey] Ignoring point with poor accuracy:', accuracy);
      return;
    }

    const now = Date.now();
    const timeSinceLastPoint = (now - lastRecordedTime.current) / 1000; // seconds

    // Check if we should record this point
    let shouldRecord = false;

    if (!lastRecordedPoint.current) {
      // First point
      shouldRecord = true;
    } else {
      const distanceMoved = calculateDistance(
        lastRecordedPoint.current.coordinates,
        coordinates
      );

      // Record if moved significant distance OR enough time passed
      if (distanceMoved >= MIN_DISTANCE_METERS || timeSinceLastPoint >= MIN_TIME_SECONDS) {
        shouldRecord = true;

        // Calculate new total distance
        const newTotalDistance = journeyStats.totalDistanceTraveled + (distanceMoved / 1000);

        const newPoint: JourneyPoint = {
          coordinates,
          timestamp: new Date(),
          accuracy,
          questIndex: currentQuestIndex
        };

        const updatedStats: JourneyStats = {
          ...journeyStats,
          totalDistanceTraveled: newTotalDistance,
          pathPoints: [...journeyStats.pathPoints, newPoint],
          durationMinutes: Math.round((now - journeyStats.startTime.getTime()) / 60000)
        };

        setJourneyStats(updatedStats);
        lastRecordedPoint.current = newPoint;
        lastRecordedTime.current = now;

        if (onJourneyUpdate) {
          onJourneyUpdate(updatedStats);
        }

        console.log('[Journey] Point recorded:', {
          distance: distanceMoved.toFixed(1),
          totalKm: newTotalDistance.toFixed(2),
          points: updatedStats.pathPoints.length
        });
      }
    }

    if (shouldRecord && !lastRecordedPoint.current) {
      // Record first point
      const firstPoint: JourneyPoint = {
        coordinates,
        timestamp: new Date(),
        accuracy,
        questIndex: currentQuestIndex
      };

      const updatedStats: JourneyStats = {
        ...journeyStats,
        pathPoints: [firstPoint]
      };

      setJourneyStats(updatedStats);
      lastRecordedPoint.current = firstPoint;
      lastRecordedTime.current = now;

      if (onJourneyUpdate) {
        onJourneyUpdate(updatedStats);
      }
    }
  }, [enabled, journeyStats, currentQuestIndex, calculateDistance, onJourneyUpdate]);

  // Mark quest completion
  const markQuestComplete = useCallback(() => {
    if (!journeyStats) return;

    const updatedStats: JourneyStats = {
      ...journeyStats,
      questCompletionTimes: [...journeyStats.questCompletionTimes, new Date()]
    };

    setJourneyStats(updatedStats);

    if (onJourneyUpdate) {
      onJourneyUpdate(updatedStats);
    }
  }, [journeyStats, onJourneyUpdate]);

  // Finalize journey
  const finalizeJourney = useCallback(() => {
    if (!journeyStats) return null;

    const finalStats: JourneyStats = {
      ...journeyStats,
      endTime: new Date(),
      durationMinutes: Math.round((Date.now() - journeyStats.startTime.getTime()) / 60000)
    };

    setJourneyStats(finalStats);
    return finalStats;
  }, [journeyStats]);

  // Reset journey with saved stats (for resume)
  const resetWithStats = useCallback((stats: JourneyStats) => {
    setJourneyStats(stats);
    // Restore last recorded point from path history
    if (stats.pathPoints.length > 0) {
      const lastPoint = stats.pathPoints[stats.pathPoints.length - 1];
      lastRecordedPoint.current = lastPoint;
      lastRecordedTime.current = new Date(lastPoint.timestamp).getTime();
    }
    hasInitialized.current = true;
    console.log('[Journey] Restored stats from save:', {
      totalKm: stats.totalDistanceTraveled.toFixed(2),
      points: stats.pathPoints.length,
      duration: stats.durationMinutes
    });
  }, []);

  return {
    journeyStats,
    recordPoint,
    markQuestComplete,
    finalizeJourney,
    resetWithStats
  };
}
