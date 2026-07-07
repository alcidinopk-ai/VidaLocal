import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Star, Crown, CheckCircle2, MessageCircle, Clock, Navigation2, Share2, Compass, X } from 'lucide-react';
import { useCity } from '../contexts/CityContext';
import { getBusinessStatus } from '../utils/hours';
import { getDirectionsUrl } from '../utils/maps';
import { EstablishmentCard } from './EstablishmentCard';
import { useAuth } from '../contexts/AuthContext';
import { parseImageArray } from '../utils/imageCompression';

interface Establishment {
  id: string;
  name: string;
  category_id?: number;
  sub_category: string;
  address: string;
  rating: number;
  whatsapp: string;
  latitude: number;
  longitude: number;
  hours?: string;
  is_premium?: boolean;
  is_verified?: boolean;
  is_featured?: boolean;
  images?: string[];
  maps_link?: string;
  phone?: string;
  website?: string;
  description?: string;
  views?: number;
}

import { calculateHaversineDistance, formatDistance, sortByDistanceAsc, auditEstablishmentsCoordinates } from '../utils/geo';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15
    }
  }
} as const;

export const NearbyEstablishments = ({ userLocation }: { userLocation?: { latitude: number; longitude: number } }) => {
  const { currentCity } = useCity();
  const { user, setIsAuthModalOpen } = useAuth();
  const [rawEstablishments, setRawEstablishments] = useState<Establishment[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEst, setSelectedEst] = useState<Establishment | null>(null);

  const [showHoursId, setShowHoursId] = useState<string | null>(null);

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    action();
  };

  // Fetch master establishments list once per city
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=&city_id=${currentCity.id}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setRawEstablishments(data);
          // Requisito 1: Auditoria das coordenadas
          auditEstablishmentsCoordinates(data, currentCity);
        } else {
          setRawEstablishments([]);
        }
      } catch (err) {
        console.error("Error fetching nearby raw data:", err);
        setRawEstablishments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();

    window.addEventListener('vida360:establishment-updated', fetchAll);
    return () => {
      window.removeEventListener('vida360:establishment-updated', fetchAll);
    };
  }, [currentCity.id]);

  // Dynamically recalculate distance and sort when location or raw data changes
  useEffect(() => {
    if (!userLocation || rawEstablishments.length === 0) {
      setEstablishments([]);
      return;
    }

    // Requisito 4 e 6: Ordenação estritamente por distância crescente, pegando os top 12
    const sorted = sortByDistanceAsc(rawEstablishments, userLocation.latitude, userLocation.longitude)
      .filter(e => isFinite(e.distance))
      .slice(0, 12);

    setEstablishments(sorted as Establishment[]);
  }, [rawEstablishments, userLocation]);

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
        <motion.div 
          key={establishments.length}
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {establishments.map((est) => {
            const statusInfo = getBusinessStatus(est.hours);
            const distance = (est as any).distance;
            const distStr = formatDistance(distance, true);
            
            return (
              <motion.div 
                key={est.id} 
                variants={itemVariants}
                className="flex flex-col h-full"
              >
                <motion.div 
                  whileHover={{ y: -5 }}
                  className="group bg-white border border-zinc-100 rounded-[32px] overflow-hidden hover:shadow-xl hover:shadow-zinc-200 transition-all flex flex-col relative cursor-pointer h-full"
                  onClick={() => setSelectedEst(est)}
                >
                  <div className="relative w-full aspect-video bg-zinc-100 overflow-hidden">
                    {(() => {
                      const parsedImgs = parseImageArray(est.images);
                      if (parsedImgs.length > 0) {
                        return (
                          <img 
                            src={parsedImgs[0]} 
                            alt={est.name} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        );
                      }
                      return (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300">
                          <MapPin className="w-8 h-8" />
                        </div>
                      );
                    })()}
                    
                    <div className="absolute top-4 right-4 px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full shadow-lg z-10">
                      {distStr}
                    </div>

                    {/* Action Buttons Overlay */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <a 
                        href={getDirectionsUrl(est.maps_link, est.latitude, est.longitude, userLocation)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) {
                            e.preventDefault();
                            setIsAuthModalOpen(true);
                          }
                        }}
                        className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-all shadow-xl"
                        title="Traçar Rota"
                      >
                        <Navigation2 className="w-4 h-4" />
                      </a>
                      <a 
                        href={est.whatsapp ? `https://wa.me/${est.whatsapp.replace(/\D/g, '')}` : "#"}
                        target={est.whatsapp ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!est.whatsapp) {
                            e.preventDefault();
                            return;
                          }
                          if (!user) {
                            e.preventDefault();
                            setIsAuthModalOpen(true);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all shadow-xl ${
                          est.whatsapp ? "hover:bg-black/40" : "opacity-40 cursor-not-allowed"
                        }`}
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      <button 
                        onClick={(e) => {
                          handleAction(e, () => {
                            const text = `Confira ${est.name} no VidaLocal!`;
                            const url = est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`;
                            if (navigator.share) {
                              navigator.share({ title: est.name, text, url });
                            } else {
                              window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                            }
                          });
                        }}
                        className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-all shadow-xl"
                        title="Compartilhar"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="mb-1">
                      <h4 className="font-bold text-zinc-900 text-sm group-hover:text-emerald-700 transition-colors">{est.name}</h4>
                    </div>
                    <p className="text-[10px] font-bold text-[#00897b] uppercase tracking-wider mb-2">{est.sub_category}</p>
                    <p className="text-xs text-zinc-400 line-clamp-1">{est.address}</p>
                    
                    <div className="flex items-center gap-3 mt-2">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowHoursId(showHoursId === est.id ? null : est.id);
                        }}
                        className={`flex items-center gap-1 text-[10px] font-bold cursor-pointer hover:opacity-70 transition-opacity ${statusInfo.color}`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        {statusInfo.label}
                      </div>
                    </div>

                    {showHoursId === est.id && est.hours && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 p-2 bg-zinc-50 rounded-xl border border-zinc-100"
                      >
                        <p className="text-[9px] text-zinc-500 font-medium whitespace-pre-line leading-relaxed">
                          {est.hours}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedEst && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 lg:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedEst(null)}
            />
            <div className="relative w-full h-full lg:h-auto overflow-hidden">
              <EstablishmentCard 
                chunk={{
                  maps: {
                    id: selectedEst.id,
                    title: selectedEst.name,
                    category_id: selectedEst.category_id,
                    categoryId: selectedEst.category_id,
                    uri: selectedEst.maps_link || '',
                    location: {
                      latitude: selectedEst.latitude,
                      longitude: selectedEst.longitude
                    },
                    rating: selectedEst.rating,
                    address: selectedEst.address,
                    hours: selectedEst.hours,
                    whatsapp: selectedEst.whatsapp,
                    phone: selectedEst.phone,
                    website: selectedEst.website,
                    description: selectedEst.description,
                    is_premium: selectedEst.is_premium,
                    is_verified: selectedEst.is_verified,
                    images: selectedEst.images,
                    subCategory: selectedEst.sub_category,
                    views: selectedEst.views
                  }
                } as any}
                distance={userLocation ? formatDistance(calculateHaversineDistance(userLocation.latitude, userLocation.longitude, selectedEst.latitude, selectedEst.longitude), true) : '---'}
                userLocation={userLocation}
                defaultOpen={true}
                onCloseDetails={() => setSelectedEst(null)}
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
