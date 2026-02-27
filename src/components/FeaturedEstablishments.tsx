import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Star, MapPin, Share2, ExternalLink, MessageCircle } from 'lucide-react';
import { useCity } from '../contexts/CityContext';

interface Establishment {
  id: string;
  name: string;
  sub_category: string;
  address: string;
  rating: number;
  whatsapp: string;
  latitude: number;
  longitude: number;
}

export const FeaturedEstablishments = () => {
  const { currentCity } = useCity();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/establishments/featured?city_id=${currentCity.id}`);
        const data = await res.json();
        setEstablishments(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeatured();
  }, [currentCity.id]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-48 bg-zinc-100 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }

  if (establishments.length === 0) return null;

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
        {establishments.map((est) => (
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
              <h4 className="font-bold text-zinc-900 text-sm mb-1 group-hover:text-[#f57c00] transition-colors">{est.name}</h4>
              <p className="text-[10px] font-bold text-[#00897b] uppercase tracking-wider mb-2">{est.sub_category}</p>
              <p className="text-xs text-zinc-400 line-clamp-1">{est.address}</p>
            </div>

            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-zinc-50">
              <a 
                href={`https://wa.me/55${est.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white rounded-xl text-[10px] font-bold hover:bg-zinc-800 transition-all"
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
          </motion.div>
        ))}
      </div>
    </div>
  );
};
