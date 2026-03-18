import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Star, MapPin, Share2, ExternalLink, MessageCircle, Navigation2, Crown, CheckCircle2, Clock } from 'lucide-react';
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
  user_id?: string;
  is_premium?: boolean;
  is_verified?: boolean;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/establishments/featured?city_id=${currentCity.id}`);
        if (!res.ok) throw new Error('Failed to fetch featured');
        const data = await res.json();
        if (Array.isArray(data)) {
          let sortedData = [...data];
          if (userLocation) {
            sortedData.sort((a, b) => {
              const distA = calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
              const distB = calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
              return distA - distB;
            });
          }
          setEstablishments(sortedData);
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
    return () => window.removeEventListener('vida360:refresh-featured', fetchFeatured);
  }, [currentCity.id, userLocation]);

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
          <h3 className="text-lg font-bold text-zinc-900">Nenhum destaque em {currentCity.name}</h3>
          <p className="text-sm text-zinc-500 mt-2">Seja o primeiro a sugerir um local incrível nesta cidade!</p>
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
            <motion.div 
              key={est.id}
              whileHover={{ y: -5 }}
              className="group bg-white border border-zinc-100 rounded-[32px] p-5 hover:shadow-xl hover:shadow-zinc-200 transition-all flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-[#f57c00] group-hover:bg-orange-50 transition-all">
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-zinc-50 rounded-full">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <span className="text-[10px] font-bold text-zinc-600">{est.rating}</span>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-bold text-zinc-900 text-sm group-hover:text-[#f57c00] transition-colors">{est.name}</h4>
                  {est.is_premium && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-500 text-white text-[8px] font-bold rounded-full shadow-sm">
                      <Crown className="w-2 h-2" />
                      Premium
                    </div>
                  )}
                  {est.is_verified && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full shadow-sm">
                      <CheckCircle2 className="w-2 h-2" />
                      Verificado
                    </div>
                  )}
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
                  <div className={`flex items-center gap-1 text-[10px] font-bold ${statusInfo.color}`}>
                    <Clock className="w-2.5 h-2.5" />
                    {statusInfo.label}
                  </div>
                  {est.hours && (
                    <p className="text-[9px] text-zinc-500 font-medium">
                      {est.hours}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-6 pt-4 border-t border-zinc-50">
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${est.latitude},${est.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#f57c00] text-white rounded-xl text-[10px] font-bold hover:bg-[#e65100] transition-all shadow-sm"
                >
                  <Navigation2 className="w-3.5 h-3.5" />
                  Traçar Rota
                </a>
                <div className="flex items-center gap-2">
                  <a 
                    href={whatsappUrl}
                    target={whatsappUrl !== "#" ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => whatsappUrl === "#" && e.preventDefault()}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-bold transition-all ${
                      whatsappUrl !== "#" ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
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
                    className="p-2.5 rounded-xl bg-zinc-50 text-zinc-400 hover:text-[#f57c00] hover:bg-orange-50 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
