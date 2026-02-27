import React, { useState, useEffect, useCallback } from 'react';
import { Search, MapPin, ChevronRight, X, Loader2, Navigation } from 'lucide-react';
import { useCity, City } from '../contexts/CityContext';
import { motion, AnimatePresence } from 'motion/react';

interface State {
  id: number;
  name: string;
  uf: string;
}

export const CitySelectorModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { currentCity, setCity } = useCity();
  const [tab, setTab] = useState<'search' | 'browse'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<City[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [citiesInState, setCitiesInState] = useState<City[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Fetch states
  useEffect(() => {
    if (isOpen) {
      fetch('/api/states')
        .then(res => res.json())
        .then(setStates);
    }
  }, [isOpen]);

  // Search cities with debounce
  useEffect(() => {
    if (tab === 'search' && searchQuery.length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        fetch(`/api/cities/search?q=${encodeURIComponent(searchQuery)}`)
          .then(res => res.json())
          .then(data => {
            setSearchResults(data);
            setIsSearching(false);
          });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, tab]);

  // Fetch cities when state is selected
  useEffect(() => {
    if (selectedState) {
      fetch(`/api/cities?state_uf=${selectedState.uf}`)
        .then(res => res.json())
        .then(setCitiesInState);
    }
  }, [selectedState]);

  const handleSelectCity = (city: City) => {
    if (city.active) {
      setCity(city);
      onClose();
    }
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch('/api/cities/resolve-by-geo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        })
        .then(res => res.json())
        .then(city => {
          if (city && city.active) {
            if (confirm(`Encontramos ${city.name} - ${city.uf}. Deseja selecionar esta cidade?`)) {
              handleSelectCity(city);
            }
          }
          setIsLocating(false);
        })
        .catch(() => setIsLocating(false));
      },
      () => setIsLocating(false)
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Selecionar Cidade</h2>
            <p className="text-xs text-zinc-500 mt-1">Cidade atual: {currentCity.name} - {currentCity.uf}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100">
          <button 
            onClick={() => setTab('search')}
            className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${tab === 'search' ? 'border-[#00897b] text-[#00897b]' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
          >
            Buscar
          </button>
          <button 
            onClick={() => setTab('browse')}
            className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 ${tab === 'browse' ? 'border-[#00897b] text-[#00897b]' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
          >
            Por Estado
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'search' ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digite o nome da cidade..."
                  className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-none rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                />
                {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#00897b]" />}
              </div>

              <button 
                onClick={handleUseLocation}
                disabled={isLocating}
                className="w-full py-4 px-4 bg-emerald-50 text-[#00897b] rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-100 transition-all font-bold text-sm disabled:opacity-50"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                Usar minha localização atual
              </button>

              <div className="space-y-2">
                {searchResults.map(city => (
                  <button
                    key={city.id}
                    onClick={() => handleSelectCity(city)}
                    disabled={!city.active}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${city.active ? 'bg-white border-zinc-100 hover:border-[#00897b] hover:shadow-md' : 'bg-zinc-50 border-zinc-100 opacity-50 cursor-not-allowed'}`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${city.active ? 'text-[#00897b]' : 'text-zinc-400'}`} />
                      <div className="text-left">
                        <span className="font-bold text-sm text-zinc-900">{city.name}</span>
                        <span className="text-xs text-zinc-400 ml-2">{city.uf}</span>
                      </div>
                    </div>
                    {!city.active && <span className="text-[10px] font-bold text-zinc-400 uppercase">Em breve</span>}
                    {city.active && <ChevronRight className="w-4 h-4 text-zinc-300" />}
                  </button>
                ))}
                {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-10">
                    <p className="text-sm text-zinc-400">Nenhuma cidade encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!selectedState ? (
                <div className="grid grid-cols-2 gap-2">
                  {states.map(state => (
                    <button
                      key={state.id}
                      onClick={() => setSelectedState(state)}
                      className="p-4 bg-zinc-50 rounded-2xl text-left hover:bg-zinc-100 transition-all group"
                    >
                      <span className="font-bold text-sm text-zinc-700 group-hover:text-zinc-900">{state.name}</span>
                      <span className="text-xs text-zinc-400 block mt-1">{state.uf}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <button 
                    onClick={() => setSelectedState(null)}
                    className="flex items-center gap-2 text-xs font-bold text-[#00897b] mb-4"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Voltar para Estados
                  </button>
                  <h3 className="font-bold text-zinc-900 mb-4">{selectedState.name}</h3>
                  <div className="space-y-2">
                    {citiesInState.map(city => (
                      <button
                        key={city.id}
                        onClick={() => handleSelectCity(city)}
                        disabled={!city.active}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${city.active ? 'bg-white border-zinc-100 hover:border-[#00897b] hover:shadow-md' : 'bg-zinc-50 border-zinc-100 opacity-50 cursor-not-allowed'}`}
                      >
                        <span className="font-bold text-sm text-zinc-900">{city.name}</span>
                        {!city.active && <span className="text-[10px] font-bold text-zinc-400 uppercase">Em breve</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export const CitySelectorButton = () => {
  const { currentCity } = useCity();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="mb-4 px-3 py-1.5 bg-black/10 backdrop-blur-md rounded-full text-white/90 text-xs font-medium flex items-center gap-2 mx-auto hover:bg-black/20 transition-all"
      >
        <MapPin className="w-3.5 h-3.5" />
        {currentCity.name} – {currentCity.uf}
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <CitySelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

const ChevronDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
