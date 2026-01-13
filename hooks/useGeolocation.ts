import { useState, useEffect } from 'react';
import { Coordinates } from '@/types';

export interface GeolocationState {
  coordinates: Coordinates | null;
  accuracy: number | null; // meters
  error: string | null;
  loading: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export function useGeolocation(enableTracking: boolean = false) {
  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    accuracy: null,
    error: null,
    loading: true,
    permissionStatus: 'unknown'
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
        permissionStatus: 'unknown'
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
        setState({
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          permissionStatus: 'granted'
        });
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

  return state;
}
