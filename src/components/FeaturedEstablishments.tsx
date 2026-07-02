import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, MapPin, Share2, ExternalLink, MessageCircle, Navigation2, Crown, CheckCircle2, Clock, X } from 'lucide-react';
import { useCity } from '../contexts/CityContext';
import { getBusinessStatus } from '../utils/hours';
import { getDirectionsUrl } from '../utils/maps';
import { EstablishmentCard } from './EstablishmentCard';
import { useAuth } from '../contexts/AuthContext';
import { parseImageArray } from '../utils/imageCompression';

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
  user_id?: string;
  is_premium?: boolean;
  is_verified?: boolean;
  is_featured?: boolean;
  images?: string[];
  maps_link?: string;
}

const calculateDistance = (lat1: number, lon1: number, lat2?: number, lon2?: number) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return Infinity;
  }
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

export const FeaturedEstablishments = ({ userLocation }: { userLocation?: { latitude: number; longitude: number } }) => {
  const { currentCity } = useCity();
  const { user, setIsAuthModalOpen } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const fetchFeatured = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/establishments/featured?city_id=${currentCity.id}`);
        if (!res.ok) throw new Error('Failed to fetch featured');
        const data = await res.json();
        if (Array.isArray(data)) {
          setEstablishments(data);
        } else {
          console.error("Featured API returned non-array data:", data);
          setEstablishments([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFeatured();

    // Listen for global refresh events
    window.addEventListener('vida360:refresh-featured', fetchFeatured);
    window.addEventListener('vida360:establishment-updated', fetchFeatured);
    return () => {
      window.removeEventListener('vida360:refresh-featured', fetchFeatured);
      window.removeEventListener('vida360:establishment-updated', fetchFeatured);
    };
  }, [currentCity.id]);

  if (isLoading) {
    return (
      <div className="mt-12 px-6 max-w-7xl mx-auto w-full pb-12">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-zinc-100 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-zinc-50 animate-pulse rounded-[32px] border border-zinc-100" />
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest animate-pulse">
            Carregando melhores locais em {currentCity.name}...
          </p>
        </div>
      </div>
    );
  }

  if (establishments.length === 0) {
    return (
      <div className="mt-12 px-6 max-w-7xl mx-auto w-full pb-12">
        <div className="bg-zinc-50 border border-dashed border-zinc-200 rounded-[32px] p-12 text-center">
          <MapPin className="w-8 h-8 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900">Em breve novos destaques da sua cidade.</h3>
          <p className="text-sm text-zinc-500 mt-2">Destaque os seus lugares favoritos ou seja o primeiro a sugerir um local incrível!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 px-6 max-w-7xl mx-auto w-full pb-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Destaques em {currentCity.name}</h3>
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest mt-1">Recomendados pela comunidade</p>
        </div>
        <button className="text-xs font-bold text-[#f57c00] hover:underline uppercase tracking-widest">Ver Todos</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {establishments.map((est) => {
          const whatsappNumber = est.whatsapp ? est.whatsapp.replace(/\D/g, '') : "";
          const formattedWhatsapp = whatsappNumber 
            ? (whatsappNumber.startsWith('55') ? whatsappNumber : `55${whatsappNumber}`)
            : "";
          const whatsappUrl = formattedWhatsapp ? `https://wa.me/${formattedWhatsapp}` : "#";
          
          const statusInfo = getBusinessStatus(est.hours);
          
          return (
            <React.Fragment key={est.id}>
              <motion.div 
                whileHover={{ y: -5 }}
                className="group bg-white border border-zinc-100 rounded-[32px] overflow-hidden hover:shadow-xl hover:shadow-zinc-200 transition-all flex flex-col cursor-pointer"
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
                  
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                    {est.is_premium && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-[8px] font-bold rounded-full shadow-lg">
                        <Crown className="w-2.5 h-2.5" />
                        PREMIUM
                      </div>
                    )}
                    {est.is_verified && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500 text-white text-[8px] font-bold rounded-full shadow-lg">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        VERIFICADO
                      </div>
                    )}
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-black/40 backdrop-blur-md text-white rounded-full">
                    <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-[9px] font-bold">{est.rating || '5.0'}</span>
                  </div>

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
                        href={whatsappUrl}
                        target={whatsappUrl !== "#" ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (whatsappUrl === "#") {
                            e.preventDefault();
                            return;
                          }
                          if (!user) {
                            e.preventDefault();
                            setIsAuthModalOpen(true);
                          }
                        }}
                        className={`flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all shadow-xl ${
                          whatsappUrl !== "#" ? "hover:bg-black/40" : "opacity-40 cursor-not-allowed"
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
                    <h4 className="font-bold text-zinc-900 text-sm group-hover:text-[#f57c00] transition-colors">{est.name}</h4>
                  </div>
                  <p className="text-[10px] font-bold text-[#00897b] uppercase tracking-wider mb-2">{est.sub_category}</p>
                  <p className="text-xs text-zinc-400 line-clamp-1">{est.address}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {est.whatsapp && (
                      <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                        <MessageCircle className="w-2.5 h-2.5" />
                        {est.whatsapp}
                      </p>
                    )}
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
            </React.Fragment>
          );
        })}
      </div>

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
                    subCategory: selectedEst.sub_category
                  }
                } as any}
                distance={userLocation ? (() => {
                  const d = calculateDistance(userLocation.latitude, userLocation.longitude, selectedEst.latitude, selectedEst.longitude);
                  return d < 1 ? `${(d * 1000).toFixed(0)} m` : `${d.toFixed(1).replace('.', ',')} km`;
                })() : '---'}
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
