import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  MapPin, 
  Search, 
  Loader2, 
  Globe, 
  Compass, 
  MessageSquare, 
  Info, 
  X, 
  Heart, 
  ShieldCheck, 
  Building2, 
  Sparkles, 
  Dog, 
  Car, 
  Home, 
  Briefcase, 
  Users, 
  GraduationCap, 
  ShoppingBag,
  LogOut,
  ChevronDown,
  CheckCircle2,
  Store,
  Plus,
  User as UserIcon
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithMaps, ChatMessage, GroundingChunk } from './services/geminiService';
import { MapDisplay } from './components/MapDisplay';
import { useCity } from './contexts/CityContext';
import { useAuth } from './contexts/AuthContext';
import { CitySelectorButton } from './components/CitySelector';
import { RegisterEstablishmentModal } from './components/RegisterEstablishmentModal';
import { AuthModal } from './components/AuthModal';
import { FeaturedEstablishments } from './components/FeaturedEstablishments';

import { CATEGORIES, SUB_CATEGORIES } from './constants/taxonomy';

const PREDEFINED_LOCATIONS = [
  { name: 'Gurupi Center', lat: -11.7298, lng: -49.0678 },
  { name: 'Local University', lat: -11.7323, lng: -49.0664 },
];

const IconRenderer = ({ name, color, className }: { name: string; color?: string; className?: string }) => {
  const icons: Record<string, any> = {
    Heart,
    ShieldCheck,
    Building2,
    Sparkles,
    Dog,
    Car,
    Home,
    Briefcase,
    Users,
    GraduationCap,
    MapPin,
    ShoppingBag
  };
  const IconComponent = icons[name] || Compass;
  return <IconComponent className={className} style={color ? { color } : {}} />;
};

export default function App() {
  const { currentCity, isLoading: isCityLoading } = useCity();
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: `Olá! Eu sou o VidaLocal, seu guia urbano local. Posso te ajudar a encontrar serviços, empresas e órgãos públicos em sua cidade. O que você procura hoje?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | undefined>();
  const [isRealLocation, setIsRealLocation] = useState(false);
  const [locationName, setLocationName] = useState<string>('Detectando...');
  const [allGroundingChunks, setAllGroundingChunks] = useState<GroundingChunk[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ intents: any[], types: string[] }>({ intents: [], types: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [view, setView] = useState<'home' | 'subcategories' | 'chat'>('home');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const detectLocation = () => {
    // Default to city center
    const defaultLoc = {
      latitude: currentCity.latitude,
      longitude: currentCity.longitude,
    };
    
    setLocation(defaultLoc);
    setIsRealLocation(false);
    setLocationName(`${currentCity.name} – ${currentCity.uf}`);

    // Try to get real location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const realLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(realLoc);
          setIsRealLocation(true);
          // We keep the city name as the location name for the UI header, 
          // but the coordinates are now real.
          console.log("Real location detected:", realLoc);
        },
        (error) => {
          console.warn("Error detecting real location, using city defaults:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  useEffect(() => {
    detectLocation();
  }, [currentCity]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectLocation = (loc: { name: string; lat: number; lng: number }) => {
    setLocation({ latitude: loc.lat, longitude: loc.lng });
    setLocationName(loc.name);
  };

  const handleCategoryClick = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    setSelectedSubCategory(null);
    setView('subcategories');
  };

  useEffect(() => {
    if (input.length >= 2) {
      const timer = setTimeout(() => {
        fetch(`/api/search/suggest?q=${encodeURIComponent(input)}`)
          .then(res => res.json())
          .then(data => {
            setSuggestions(data);
            setShowSuggestions(true);
          });
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowSuggestions(false);
    }
  }, [input]);

  const handleSelectSuggestion = (type: string) => {
    setInput(type);
    setShowSuggestions(false);
    performSearch(type, true);
  };

  const handleBackToCategories = () => {
    setActiveCategoryId(null);
    setSelectedSubCategory(null);
    setView('home');
  };

  const handleSubCategoryClick = (subCategoryName: string) => {
    setSelectedSubCategory(subCategoryName);
    const categoryName = CATEGORIES.find(c => c.id === activeCategoryId)?.name;
    const query = `Quero ver estabelecimentos do tipo ${subCategoryName} (Categoria: ${categoryName}) em ${currentCity.name} - ${currentCity.uf}`;
    
    // Open map panel to show establishments
    setIsMapOpen(true);
    setView('chat');
    
    // Trigger search automatically
    performSearch(query, true);
  };

  const performSearch = async (query: string, clearPrevious: boolean = false) => {
    if (isLoading) return;

    // Direct to chat view if not already there
    if (view !== 'chat') {
      setView('chat');
      if (!selectedSubCategory) {
        setSelectedSubCategory(query);
      }
    }

    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    if (clearPrevious) {
      setAllGroundingChunks([]);
    }

    // Parallel search: Local Database + Gemini (Maps Grounding)
    try {
      const localResults = await fetch(`/api/search?q=${encodeURIComponent(query)}&city_id=${currentCity.id}`)
        .then(res => res.json())
        .catch(() => []);

      // Create context string for Gemini
      const localContext = localResults
        .filter((item: any) => item.id && item.name && item.latitude)
        .map((est: any) => `- ${est.name}: ${est.address} (${est.sub_category})`)
        .join("\n");

      const response = await chatWithMaps(query, currentCity, location, localContext);

      // Convert local results to GroundingChunks
      const localChunks: GroundingChunk[] = localResults
        .filter((item: any) => item.id && item.name && item.latitude)
        .map((est: any) => ({
          maps: {
            title: est.name,
            uri: est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`,
            location: {
              latitude: est.latitude,
              longitude: est.longitude
            }
          }
        }));

      setMessages(prev => [...prev, response]);
      
      const allNewChunks = [...localChunks, ...(response.groundingChunks || [])];
      
      if (allNewChunks.length > 0) {
        setAllGroundingChunks(prev => {
          const newChunks = allNewChunks.filter(
            nc => !prev.some(pc => pc.maps?.uri === nc.maps?.uri)
          );
          return [...newChunks, ...prev].slice(0, 20);
        });
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    performSearch(input, false); // Keep previous if searching manually
    setInput('');
  };

  if (isCityLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white">
        <div className="w-20 h-20 bg-[#00897b] rounded-3xl flex items-center justify-center text-white mb-6 animate-pulse">
          <MapPin className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">VidaLocal</h1>
        <p className="text-sm text-zinc-400 mt-2 animate-bounce">Detectando sua localização...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white text-zinc-900 font-sans overflow-hidden">
      {/* Sidebar / Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-200">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-6 bg-white z-20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#00897b] rounded-xl flex items-center justify-center text-white">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex items-baseline">
              <span className="font-bold text-xl text-zinc-900">Vida</span>
              <span className="font-bold text-xl text-[#f57c00]">Local</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsRegisterModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#00897b] text-xs font-bold rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
            >
              <Plus className="w-4 h-4" />
              Sugira um Local
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{user.email}</p>
                  <button 
                    onClick={() => signOut()}
                    className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    Sair
                  </button>
                </div>
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 border border-zinc-200">
                  <UserIcon className="w-5 h-5" />
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-2"
              >
                <UserIcon className="w-4 h-4" />
                Entrar
              </button>
            )}
            
            <button 
              onClick={() => setIsMapOpen(!isMapOpen)}
              className="lg:hidden p-2 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          <AnimatePresence mode="wait">
            {view === 'home' ? (
              /* Home Screen: Hero + Categories */
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col"
              >
                {/* Hero Section */}
                <div className="relative min-h-[240px] flex flex-col items-center justify-center px-6 py-4 text-center overflow-hidden">
                  {/* Background Gradient & Pattern */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00897b] via-[#00796b] to-[#f57c00] opacity-90 z-0" />
                  <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/city/1920/1080?blur=10')] bg-cover bg-center mix-blend-overlay opacity-30 z-0" />
                  
                  <div className="relative z-10 max-w-4xl mx-auto w-full">
                    <CitySelectorButton />

                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-2 leading-[1.1]">
                      VidaLocal
                    </h2>
                    
                    <p className="text-base text-white/90 mb-4 max-w-2xl mx-auto leading-relaxed">
                      Conectando você ao melhor da sua cidade, todos os dias.
                    </p>

                    {/* Hero Search Bar */}
                    <div className="relative max-w-xl mx-auto w-full mb-4">
                      <div className="bg-white p-1.5 rounded-2xl shadow-2xl flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 pl-3">
                          <Search className="w-4 h-4 text-zinc-400" />
                          <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && performSearch(input, true)}
                            onFocus={() => input.length >= 2 && setShowSuggestions(true)}
                            placeholder="O que você precisa agora?"
                            className="w-full bg-transparent border-none focus:ring-0 text-zinc-900 placeholder:text-zinc-400 text-sm"
                          />
                        </div>
                        <button 
                          onClick={() => performSearch(input, true)}
                          className="px-6 py-2.5 bg-[#f57c00] text-white text-sm font-bold rounded-xl hover:bg-[#e65100] transition-all shadow-lg active:scale-95"
                        >
                          Buscar
                        </button>
                      </div>

                      <p className="mt-2 text-[10px] sm:text-xs text-white/80 italic font-medium max-w-lg mx-auto leading-relaxed">
                        "Disse-lhe Jesus: Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim." — João 14:6
                      </p>

                      {/* Intelligent Suggestions */}
                      <AnimatePresence>
                        {showSuggestions && (suggestions.types.length > 0 || suggestions.intents.length > 0) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-[60] p-4"
                          >
                            {suggestions.intents.length > 0 && (
                              <div className="mb-4">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Intenções Detectadas</span>
                                <div className="flex flex-wrap gap-2">
                                  {suggestions.intents.map(intent => (
                                    <button 
                                      key={intent.id}
                                      onClick={() => handleSelectSuggestion(intent.name)}
                                      className="px-3 py-1.5 bg-zinc-50 text-zinc-600 rounded-lg text-xs font-bold hover:bg-zinc-100 transition-colors border border-zinc-100"
                                    >
                                      {intent.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {suggestions.types.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">Sugestões de Filtro</span>
                                <div className="flex flex-wrap gap-2">
                                  {suggestions.types.map(type => (
                                    <button 
                                      key={type}
                                      onClick={() => handleSelectSuggestion(type)}
                                      className="px-3 py-1.5 bg-emerald-50 text-[#00897b] rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center gap-1.5"
                                    >
                                      <Search className="w-3 h-3" />
                                      {type}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Categories Section */}
                <div className="px-6 py-4 max-w-7xl mx-auto w-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-zinc-900">Categorias</h3>
                    <span className="text-xs font-medium text-zinc-400">12 categorias nacionais</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryClick(cat.id)}
                        className="group flex flex-col items-center p-4 bg-white border border-zinc-100 rounded-[24px] hover:shadow-lg hover:shadow-zinc-200 transition-all aspect-square justify-center"
                      >
                        <div 
                          className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm"
                          style={{ backgroundColor: cat.color + '15' }}
                        >
                          <IconRenderer name={cat.icon} color={cat.color} className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold text-zinc-800 text-center leading-tight group-hover:text-zinc-900 transition-colors">
                          {cat.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Featured Section */}
                <FeaturedEstablishments />
              </motion.div>
            ) : view === 'subcategories' ? (
              /* Subcategories Screen */
              <motion.div
                key="subcategories"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col p-6 sm:p-10"
              >
                <div className="max-w-4xl mx-auto w-full">
                  <button 
                    onClick={handleBackToCategories}
                    className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors font-bold text-sm"
                  >
                    <X className="w-4 h-4" />
                    Voltar para Categorias
                  </button>
                  
                  <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                      <div 
                        className="w-3 h-8 rounded-full"
                        style={{ backgroundColor: CATEGORIES.find(c => c.id === activeCategoryId)?.color }}
                      />
                      <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">
                        {CATEGORIES.find(c => c.id === activeCategoryId)?.name}
                      </h2>
                    </div>
                    <p className="text-zinc-500">Escolha um tipo de estabelecimento para ver no mapa</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {SUB_CATEGORIES.filter(sc => sc.categoryId === activeCategoryId).map((sub) => {
                      const parentColor = CATEGORIES.find(c => c.id === activeCategoryId)?.color || '#000';
                      return (
                        <button
                          key={sub.id}
                          onClick={() => handleSubCategoryClick(sub.name)}
                          style={{ borderColor: parentColor + '20' }}
                          className="flex items-center justify-between p-4 bg-white border rounded-2xl hover:bg-zinc-50 hover:border-zinc-300 transition-all group"
                        >
                          <span className="text-sm font-bold text-zinc-700">{sub.name}</span>
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: parentColor }}
                          >
                            <MapPin className="w-4 h-4" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Chat / Results Screen */
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col"
              >
                {/* Header for Chat View */}
                <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        if (activeCategoryId) {
                          setView('subcategories');
                          setSelectedSubCategory(null);
                        } else {
                          setView('home');
                          setSelectedSubCategory(null);
                        }
                      }}
                      className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Exibindo</span>
                      <h3 className="text-sm font-bold text-zinc-900">{selectedSubCategory}</h3>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {CATEGORIES.find(c => c.id === activeCategoryId) && (
                      <div 
                        className="px-3 py-1 rounded-full text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: CATEGORIES.find(c => c.id === activeCategoryId)?.color }}
                      >
                        {CATEGORIES.find(c => c.id === activeCategoryId)?.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth"
                >
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`
                            px-5 py-3.5 rounded-2xl text-sm leading-relaxed
                            ${msg.role === 'user' 
                              ? 'bg-zinc-900 text-white rounded-tr-none' 
                              : 'bg-zinc-100 text-zinc-800 rounded-tl-none border border-zinc-200'}
                          `}>
                            <div className="markdown-body prose prose-sm max-w-none">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          </div>
                          
                          {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {msg.groundingChunks.map((chunk, cIdx) => (
                                <a
                                  key={cIdx}
                                  href={chunk.maps?.uri || chunk.web?.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-zinc-200 rounded-full text-[10px] font-medium text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 transition-all shadow-sm"
                                >
                                  {chunk.maps ? <MapPin className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                  {chunk.maps?.title || chunk.web?.title || 'Source'}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-zinc-100 px-5 py-3.5 rounded-2xl rounded-tl-none border border-zinc-200 flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                        <span className="text-sm text-zinc-500 font-medium">Analisando dados locais...</span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input */}
                <div className="p-6 border-t border-zinc-200 bg-white">
                  <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Pergunte sobre restaurantes, locais ou informações..."
                      className="w-full pl-5 pr-14 py-4 bg-zinc-100 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className="absolute right-2 top-2 bottom-2 px-4 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <p className="text-center mt-4 text-[10px] text-zinc-400 uppercase tracking-widest font-bold">
                    Powered by VidaLocal & Google Maps
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Map Display Panel */}
      <div className={`
        ${isMapOpen ? 'fixed inset-0 z-50 bg-white' : 'hidden'} 
        lg:static lg:block lg:w-[400px] shrink-0 border-l border-zinc-200
      `}>
        {isMapOpen && (
          <button 
            onClick={() => setIsMapOpen(false)}
            className="lg:hidden absolute top-4 right-4 z-50 p-2 rounded-full bg-white shadow-md border border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <MapDisplay chunks={allGroundingChunks} userLocation={location} isRealLocation={isRealLocation} isLoading={isLoading} />
      </div>
      {/* Floating Action Button for Mobile - Suggest Local */}
      <button 
        onClick={() => setIsRegisterModalOpen(true)}
        className="md:hidden fixed bottom-24 right-6 z-40 w-14 h-14 bg-[#00897b] text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <RegisterEstablishmentModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}
