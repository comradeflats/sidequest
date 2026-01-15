import { useState, useEffect, useCallback } from 'react';
import { Coordinates } from '@/types';

export interface GeolocationState {
  coordinates: Coordinates | null;
  accuracy: number | null; // meters
  error: string | null;
  loading: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  isRefreshing: boolean;
}

export interface UseGeolocationReturn extends GeolocationState {
  refreshLocation: () => Promise<Coordinates | null>;
}

export function useGeolocation(enableTracking: boolean = false): UseGeolocationReturn {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    accuracy: null,
    error: null,
    loading: true,
    permissionStatus: 'unknown',
    isRefreshing: false
  });

  useEffect(() => {
    if (!enableTracking) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    if (!navigator.geolocation) {
      setState({
        coordinates: null,
        accuracy: null,
        error: 'Geolocation not supported by browser',
        loading: false,
        permissionStatus: 'unknown',
        isRefreshing: false
      });
      return;
    }

    // Check permission status
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setState(prev => ({
          ...prev,
          permissionStatus: result.state as 'granted' | 'denied' | 'prompt'
        }));
      }).catch(() => {
        // Permission API not supported or failed
        setState(prev => ({ ...prev, permissionStatus: 'unknown' }));
      });
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setState(prev => ({
          ...prev,
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          permissionStatus: 'granted'
        }));
      },
      (error) => {
        setState(prev => ({
          ...prev,
          error: error.message,
          loading: false,
          permissionStatus: error.code === error.PERMISSION_DENIED ? 'denied' : prev.permissionStatus
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enableTracking]);

  // Manual refresh function for one-shot high-accuracy location
  const refreshLocation = useCallback((): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      setState(prev => ({ ...prev, isRefreshing: true }));

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setState(prev => ({
            ...prev,
            coordinates: coords,
            accuracy: position.coords.accuracy,
            error: null,
            isRefreshing: false,
            permissionStatus: 'granted'
          }));
          console.log('[GPS] Refreshed location:', {
            lat: coords.lat.toFixed(6),
            lng: coords.lng.toFixed(6),
            accuracy: position.coords.accuracy.toFixed(0)
          });
          resolve(coords);
        },
        (error) => {
          setState(prev => ({
            ...prev,
            error: error.message,
            isRefreshing: false,
            permissionStatus: error.code === error.PERMISSION_DENIED ? 'denied' : prev.permissionStatus
          }));
          console.error('[GPS] Refresh failed:', error.message);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // Longer timeout for manual refresh
          maximumAge: 0   // Force fresh reading
        }
      );
    });
  }, []);

  return {
    ...state,
    refreshLocation
  };
}
