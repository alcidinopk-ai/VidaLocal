import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Star, Crown, CheckCircle2, MessageCircle, Clock, Navigation2, Share2, Compass } from 'lucide-react';
import { useCity } from '../contexts/CityContext';
import { getBusinessStatus } from '../utils/hours';

interface Establishment {
  id: string;
  name: string;
  sub_category: string;
  address: string;
  rating: number;
  whatsapp: string;
  latitude: number;
  longitude: number;
  hours?: string;
  is_premium?: boolean;
  is_verified?: boolean;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const NearbyEstablishments = ({ userLocation }: { userLocation?: { latitude: number; longitude: number } }) => {
  const { currentCity } = useCity();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userLocation) return;

    const fetchNearby = async () => {
      setIsLoading(true);
      try {
        // Fetch all in city and sort by distance
        const res = await fetch(`/api/search?q=&city_id=${currentCity.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          const sorted = data
            .map(e => ({
              ...e,
              distance: calculateDistance(userLocation.latitude, userLocation.longitude, e.latitude, e.longitude)
            }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 8);
          setEstablishments(sorted);
        }
      } catch (err) {
        console.error("Error fetching nearby:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNearby();
  }, [currentCity.id, userLocation]);

  if (!userLocation || (establishments.length === 0 && !isLoading)) return null;

  return (
    <div className="mt-12 px-6 max-w-7xl mx-auto w-full pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-emerald-600" />
            <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Próximos a Você</h3>
          </div>
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest mt-1">Baseado na sua localização GPS</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-zinc-50 animate-pulse rounded-[32px] border border-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {establishments.map((est: any) => {
            const statusInfo = getBusinessStatus(est.hours);
            const distStr = est.distance < 1 ? `${(est.distance * 1000).toFixed(0)} m` : `${est.distance.toFixed(1)} km`;
            
            return (
              <motion.div 
                key={est.id}
                whileHover={{ y: -5 }}
                className="group bg-white border border-zinc-100 rounded-[32px] p-5 hover:shadow-xl hover:shadow-zinc-200 transition-all flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-4 right-4 px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full shadow-sm z-10">
                  {distStr}
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-all">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-bold text-zinc-900 text-sm group-hover:text-emerald-700 transition-colors">{est.name}</h4>
                  </div>
                  <p className="text-[10px] font-bold text-[#00897b] uppercase tracking-wider mb-2">{est.sub_category}</p>
                  <p className="text-xs text-zinc-400 line-clamp-1">{est.address}</p>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <div className={`flex items-center gap-1 text-[10px] font-bold ${statusInfo.color}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {statusInfo.label}
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-50 flex gap-2">
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${est.latitude},${est.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-bold hover:bg-emerald-700 transition-all shadow-sm"
                  >
                    <Navigation2 className="w-3.5 h-3.5" />
                    Rota
                  </a>
                  <button 
                    onClick={() => {
                      const text = `Confira ${est.name} no VidaLocal!`;
                      const url = `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`;
                      if (navigator.share) {
                        navigator.share({ title: est.name, text, url });
                      } else {
                        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                      }
                    }}
                    className="p-2.5 rounded-xl bg-zinc-50 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
