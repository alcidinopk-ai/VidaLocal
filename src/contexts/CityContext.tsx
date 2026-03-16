import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

export const CityProvider = ({ children }: { children: ReactNode }) => {
  const [currentCity, setCurrentCity] = useState<City>(DEFAULT_CITY);
  const [isLoading, setIsLoading] = useState(true);

  const resolveCityByGeo = async (lat: number, lng: number) => {
    try {
      const res = await fetch('/api/cities/resolve-by-geo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      if (res.ok) {
        const city = await res.json();
        if (city && city.active) {
          setCurrentCity(city);
          localStorage.setItem('vida360_city', JSON.stringify(city));
          console.log(`Auto-detected city: ${city.name}`);
        }
      }
    } catch (error) {
      console.error("Failed to resolve city by geo:", error);
    }
  };

  const skipLoading = () => setIsLoading(false);

  useEffect(() => {
    const initCity = async () => {
      // 1. Check localStorage first for instant load
      const saved = localStorage.getItem('vida360_city');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.active) {
            setCurrentCity(parsed);
            setIsLoading(false);
            // Still try to update location in background if possible
            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => resolveCityByGeo(pos.coords.latitude, pos.coords.longitude),
                () => {},
                { timeout: 3000, enableHighAccuracy: false }
              );
            }
            return;
          }
        } catch (e) {}
      }

      // 2. If no saved city, try Geolocation (Automatic detection)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await resolveCityByGeo(pos.coords.latitude, pos.coords.longitude);
            setIsLoading(false);
          },
          (error) => {
            console.warn("Geolocation denied or failed, using default city:", error);
            setIsLoading(false);
          },
          { timeout: 3000, enableHighAccuracy: false }
        );
      } else {
        setIsLoading(false);
      }
    };

    initCity();
  }, []);

  const setCity = (city: City) => {
    if (!city.active) return;
    setCurrentCity(city);
    // We still save to localStorage so if they refresh WITHIN the session 
    // or if geolocation fails next time, they have their preference.
    // But the useEffect above will always try geolocation FIRST on a fresh load.
    localStorage.setItem('vida360_city', JSON.stringify(city));
  };

  return (
    <CityContext.Provider value={{ currentCity, setCity, isLoading, skipLoading }}>
      {children}
    </CityContext.Provider>
  );
};

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) throw new Error('useCity must be used within a CityProvider');
  return context;
};
