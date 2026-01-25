'use client';

import { useState, useEffect, useCallback } from 'react';
import { UnitSystem, getUnitPreference, setUnitPreference } from '@/lib/units';

/**
 * Hook for managing unit system preference (metric/imperial)
 */
export function useUnitPreference() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = getUnitPreference();
    setUnitSystem(stored);
    setIsLoaded(true);
  }, []);

  // Toggle between metric and imperial
  const toggleUnit = useCallback(() => {
    const newSystem: UnitSystem = unitSystem === 'metric' ? 'imperial' : 'metric';
    setUnitSystem(newSystem);
    setUnitPreference(newSystem);
  }, [unitSystem]);

  // Set a specific unit system
  const setUnit = useCallback((system: UnitSystem) => {
    setUnitSystem(system);
    setUnitPreference(system);
  }, []);

  return {
    unitSystem,
    isLoaded,
    toggleUnit,
    setUnit,
    isMetric: unitSystem === 'metric',
    isImperial: unitSystem === 'imperial',
  };
}
