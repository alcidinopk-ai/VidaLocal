import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auditUserLocationLog } from '../utils/geo';

export interface City {
  id: number;
  name: string;
  uf: string;
  active: boolean;
  latitude: number;
  longitude: number;
}

interface CityContextType {
  currentCity: City;
  setCity: (city: City) => void;
  isLoading: boolean;
  skipLoading: () => void;
  selectionMode: 'gps' | 'manual';
  gpsCity: City | null;
  gpsError: string | null;
  isLocatingGps: boolean;
  revertToGps: () => Promise<void>;
  locationPermissionStatus: 'prompt' | 'granted' | 'denied';
}

const DEFAULT_CITY: City = {
  id: 1,
  name: "Gurupi",
  uf: "TO",
  active: true,
  latitude: -11.7298,
  longitude: -49.0678
};

const CityContext = createContext<CityContextType | undefined>(undefined);

// Helper for GPS distance calculation (Haversine formula)
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; 
};

export const CityProvider = ({ children }: { children: ReactNode }) => {
  const [currentCity, setCurrentCity] = useState<City>(DEFAULT_CITY);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sprint 2.3 States
  const [selectionMode, setSelectionMode] = useState<'gps' | 'manual'>('gps');
  const [gpsCity, setGpsCity] = useState<City | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Load cache helper
  const getCachedGps = (): { city: City; lat: number; lng: number; time: number } | null => {
    try {
      const saved = localStorage.getItem('vida360_gps_cache');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const saveGpsCache = (city: City, lat: number, lng: number) => {
    try {
      localStorage.setItem('vida360_gps_cache', JSON.stringify({
        city,
        lat,
        lng,
        time: Date.now()
      }));
    } catch (e) {}
  };

  const resolveCityByGeo = async (lat: number, lng: number): Promise<City | null> => {
    // Check if we have a valid cache within 15 minutes and 5km of the coordinate
    const cache = getCachedGps();
    if (cache && cache.city && cache.city.active) {
      const dist = getDistance(lat, lng, cache.lat, cache.lng);
      const isFresh = (Date.now() - cache.time) < 15 * 60 * 1000; // 15 mins
      if (dist < 5 && isFresh) {
        console.log(`[GPS Cache] Re-using cached city: ${cache.city.name} (${dist.toFixed(2)} km away, fresh)`);
        setGpsCity(cache.city);
        setGpsError(null);
        return cache.city;
      }
    }

    try {
      const res = await fetch('/api/cities/resolve-by-geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      if (res.ok) {
        const city = await res.json();
        if (city && city.active) {
          setGpsCity(city);
          setGpsError(null);
          saveGpsCache(city, lat, lng);
          return city;
        }
      }
    } catch (error) {
      console.error("Failed to resolve city by geo:", error);
    }
    return null;
  };

  const skipLoading = () => setIsLoading(false);

  // Function to run GPS tracking and resolve city
  const runGpsResolution = async (forceSelect = false): Promise<void> => {
    if (!navigator.geolocation) {
      setGpsError("Seu navegador não possui suporte a geolocalização.");
      setLocationPermissionStatus('denied');
      setIsLoading(false);
      return;
    }

    setIsLocatingGps(true);
    setGpsError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setLocationPermissionStatus('granted');
          const resolved = await resolveCityByGeo(pos.coords.latitude, pos.coords.longitude);
          if (resolved) {
            auditUserLocationLog(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, resolved.name);
            if (forceSelect || selectionMode === 'gps') {
              setCurrentCity(resolved);
            }
          } else {
            // Unresolved city fallback
            setGpsError("Sua cidade atual ainda não está disponível no VidaLocal.");
          }
          setIsLocatingGps(false);
          setIsLoading(false);
          resolve();
        },
        (error) => {
          setIsLocatingGps(false);
          setIsLoading(false);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationPermissionStatus('denied');
            setGpsError("Permissão de localização negada. Ative o GPS para localizar sua cidade automaticamente.");
          } else {
            setGpsError("Não foi possível obter sua localização atual via GPS.");
          }
          resolve();
        },
        { timeout: 7000, enableHighAccuracy: true }
      );
    });
  };

  // Revert back from Manual Selection to GPS auto-detection
  const revertToGps = async () => {
    sessionStorage.removeItem('vida360_manual_city');
    setSelectionMode('gps');
    await runGpsResolution(true);
  };

  // Manual city selection (lasts only for current session as requested)
  const setCity = (city: City) => {
    if (!city.active) return;
    setCurrentCity(city);
    setSelectionMode('manual');
    sessionStorage.setItem('vida360_manual_city', JSON.stringify(city));
  };

  useEffect(() => {
    const initCity = async () => {
      // 1. Check current session's manual selection in sessionStorage first
      const sessionSaved = sessionStorage.getItem('vida360_manual_city');
      if (sessionSaved) {
        try {
          const parsed = JSON.parse(sessionSaved);
          if (parsed.active) {
            setCurrentCity(parsed);
            setSelectionMode('manual');
            setIsLoading(false);
            // Still run GPS resolution in the background so we have GPS ready if they revert
            runGpsResolution(false);
            return;
          }
        } catch (e) {}
      }

      // 2. If no sessionSaved, automatically use GPS detection (Default on load)
      setSelectionMode('gps');
      await runGpsResolution(true);
    };

    initCity();
  }, []);

  return (
    <CityContext.Provider value={{ 
      currentCity, 
      setCity, 
      isLoading, 
      skipLoading,
      selectionMode,
      gpsCity,
      gpsError,
      isLocatingGps,
      revertToGps,
      locationPermissionStatus
    }}>
      {children}
    </CityContext.Provider>
  );
};

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) throw new Error('useCity must be used within a CityProvider');
  return context;
};
