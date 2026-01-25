// Unit system types and conversion utilities

export type UnitSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'unit_preference';

/**
 * Get the user's unit system preference from localStorage
 */
export function getUnitPreference(): UnitSystem {
  if (typeof window === 'undefined') return 'metric';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'imperial' || stored === 'metric') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return 'metric';
}

/**
 * Save the user's unit system preference to localStorage
 */
export function setUnitPreference(system: UnitSystem): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, system);
  } catch {
    // localStorage not available
  }
}

/**
 * Format a distance value (in km) for display
 *
 * Metric: Shows meters for < 1km, kilometers otherwise
 * Imperial: Shows feet for < 0.1mi, miles otherwise
 */
export function formatDistance(km: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const miles = km * 0.621371;
    if (miles < 0.1) {
      const feet = km * 3280.84;
      return `${feet.toFixed(0)}ft`;
    }
    return `${miles.toFixed(1)}mi`;
  }

  // Metric
  if (km < 1) {
    return `${(km * 1000).toFixed(0)}m`;
  }
  return `${km.toFixed(1)}km`;
}

/**
 * Format a distance value (in km) for display, always showing the unit suffix
 */
export function formatDistanceWithUnit(km: number, system: UnitSystem): { value: string; unit: string } {
  if (system === 'imperial') {
    const miles = km * 0.621371;
    if (miles < 0.1) {
      const feet = km * 3280.84;
      return { value: feet.toFixed(0), unit: 'ft' };
    }
    return { value: miles.toFixed(1), unit: 'mi' };
  }

  // Metric
  if (km < 1) {
    return { value: (km * 1000).toFixed(0), unit: 'm' };
  }
  return { value: km.toFixed(1), unit: 'km' };
}

/**
 * Format GPS accuracy (in meters) for display
 */
export function formatAccuracy(meters: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const feet = meters * 3.28084;
    return `\u00B1${feet.toFixed(0)}ft`;
  }
  return `\u00B1${meters.toFixed(0)}m`;
}

/**
 * Convert meters to the appropriate display unit
 */
export function formatMeters(meters: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const feet = meters * 3.28084;
    if (feet >= 5280) {
      const miles = feet / 5280;
      return `${miles.toFixed(1)}mi`;
    }
    return `${feet.toFixed(0)}ft`;
  }

  // Metric
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)}km`;
  }
  return `${meters.toFixed(0)}m`;
}
