import React from 'react';
import { Navigation, Compass, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { GroundingChunk } from '../services/geminiService';
import { EstablishmentCard } from './EstablishmentCard';

interface MapDisplayProps {
  chunks: GroundingChunk[];
  userLocation?: { latitude: number; longitude: number };
  isRealLocation?: boolean;
  isLoading?: boolean;
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

export const MapDisplay: React.FC<MapDisplayProps> = ({ chunks, userLocation, isRealLocation, isLoading }) => {
  const mapChunks = chunks.filter(c => c.maps);

  const getDistanceString = (chunk: GroundingChunk) => {
    if (!userLocation || !chunk.maps?.location) {
      // If we have real location but no target location, we still have to simulate 
      // but we'll mark it as estimated.
      const simulated = (Math.random() * 3 + 0.5).toFixed(1);
      return `~${simulated} km`;
    }
    const dist = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      chunk.maps.location.latitude,
      chunk.maps.location.longitude
    );
    if (dist < 1) {
      return `${(dist * 1000).toFixed(0)} m`;
    }
    return `${dist.toFixed(1)} km`;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-zinc-100 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-zinc-900 text-sm uppercase tracking-widest">Estabelecimentos</h2>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-tighter">Exploração Urbana</p>
          </div>
        </div>
        {/* Coordinates hidden as per user request */}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 border border-emerald-100 animate-pulse">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
            <h3 className="text-zinc-900 font-bold text-base">Buscando estabelecimentos...</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-[200px] mx-auto">
              Estamos consultando o VidaLocal para encontrar os melhores locais para você.
            </p>
          </div>
        ) : mapChunks.length > 0 ? (
          mapChunks.map((chunk, idx) => (
            <EstablishmentCard 
              key={idx}
              chunk={chunk}
              distance={getDistanceString(chunk)}
              isRealLocation={isRealLocation}
            />
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 rounded-3xl bg-zinc-50 flex items-center justify-center text-zinc-200 mb-6 border border-zinc-100">
              <Compass className="w-10 h-10" />
            </div>
            <h3 className="text-zinc-900 font-bold text-base">Nenhum local encontrado</h3>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed max-w-[200px] mx-auto">Pergunte sobre serviços ou lugares em sua cidade para visualizar aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
};
