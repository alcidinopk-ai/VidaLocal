import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Printer,
  RefreshCw,
  User as UserIcon
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithMaps, ChatMessage, GroundingChunk } from './services/geminiService';
import { MapDisplay } from './components/MapDisplay';
import { EstablishmentCard } from './components/EstablishmentCard';
import { useCity } from './contexts/CityContext';
import { useAuth } from './contexts/AuthContext';
import { CitySelectorButton } from './components/CitySelector';
import { RegisterEstablishmentModal } from './components/RegisterEstablishmentModal';
import { UserEstablishmentsModal } from './components/UserEstablishmentsModal';
import { AuthModal } from './components/AuthModal';
import { FeaturedEstablishments } from './components/FeaturedEstablishments';

import { MaintenanceTools } from './components/MaintenanceTools';
import { ExportTools } from './components/ExportTools';
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

export default function App() {
  const { currentCity, isLoading: isCityLoading, skipLoading } = useCity();
  const { user, signOut } = useAuth();
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    if (isCityLoading) {
      const timer = setTimeout(() => setShowSkip(true), 2500);
      return () => clearTimeout(timer);
    }
  }, [isCityLoading]);

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
  const [categoryEstablishments, setCategoryEstablishments] = useState<any[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUserEstModalOpen, setIsUserEstModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ intents: any[], types: string[] }>({ intents: [], types: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [view, setView] = useState<'home' | 'subcategories' | 'chat' | 'maintenance'>('home');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [isDetecting, setIsDetecting] = useState(false);

  const detectLocation = useCallback(() => {
    setIsDetecting(true);
    // Default to city center
    const defaultLoc = {
      latitude: currentCity.latitude,
      longitude: currentCity.longitude,
    };
    
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
          setLocationName("Minha Localização (GPS)");
          setIsDetecting(false);
          console.log("Real location detected:", realLoc);
        },
        (error) => {
          console.warn("Error detecting real location, using city defaults:", error);
          setIsDetecting(false);
          // Use functional update to check current location state without dependency
          setLocation(prev => {
            if (!prev) {
              setIsRealLocation(false);
              setLocationName(`${currentCity.name} – ${currentCity.uf}`);
              return defaultLoc;
            }
            return prev;
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsDetecting(false);
      setLocation(prev => {
        if (!prev) {
          setIsRealLocation(false);
          setLocationName(`${currentCity.name} – ${currentCity.uf}`);
          return defaultLoc;
        }
        return prev;
      });
    }
  }, [currentCity]);

  useEffect(() => {
    detectLocation();
    
    // Pre-populate map with featured establishments
    fetch(`/api/establishments/featured?city_id=${currentCity.id}`)
      .then(res => res.json())
      .then(data => {
        const initialChunks: GroundingChunk[] = data.map((est: any) => ({
          maps: {
            id: est.id,
            title: est.name,
            categoryId: est.category_id,
            subCategory: est.sub_category,
            cityId: est.city_id,
            address: est.address,
            hours: est.hours,
            description: est.description,
            uri: est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`,
            phone: est.phone,
            whatsapp: est.whatsapp,
            user_id: est.user_id,
            is_featured: est.is_featured,
            is_verified: est.is_verified,
            is_premium: est.is_premium,
            location: {
              latitude: est.latitude,
              longitude: est.longitude
            }
          }
        }));
        setAllGroundingChunks(initialChunks);
      })
      .catch(err => console.error("Error fetching initial establishments:", err));
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

  const fetchCategoryEstablishments = useCallback(async (categoryId: number) => {
    setIsCategoryLoading(true);
    try {
      const res = await fetch(`/api/establishments/category/${categoryId}?city_id=${currentCity.id}`);
      let data = await res.json();
      
      if (location && Array.isArray(data)) {
        data.sort((a, b) => {
          const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
          const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
          return distA - distB;
        });
      }
      
      setCategoryEstablishments(data);
    } catch (err) {
      console.error("Error fetching category establishments:", err);
    } finally {
      setIsCategoryLoading(false);
    }
  }, [currentCity.id, location]);

  // Re-sort when location changes
  useEffect(() => {
    if (location) {
      setCategoryEstablishments(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const sorted = [...prev].sort((a, b) => {
          const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
          const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
          return distA - distB;
        });
        return sorted;
      });

      setAllGroundingChunks(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const sorted = [...prev].sort((a, b) => {
          const locA = a.maps?.location;
          const locB = b.maps?.location;
          if (!locA || !locB) return 0;
          const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
          const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
          return distA - distB;
        });
        return sorted;
      });
    }
  }, [location]);

  const handleCategoryClick = (categoryId: number) => {
    setActiveCategoryId(categoryId);
    setSelectedSubCategory(null);
    setView('subcategories');
    fetchCategoryEstablishments(categoryId);
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
    const query = `${subCategoryName} em ${currentCity.name}${currentCity.uf ? ` - ${currentCity.uf}` : ''}`;
    
    // Trigger search automatically with strict filters
    performSearch(query, true, activeCategoryId || undefined, subCategoryName);
  };

  const performSearch = useCallback(async (
    query: string, 
    clearPrevious: boolean = false, 
    categoryId?: number, 
    subCategory?: string
  ) => {
    if (isLoading || !query.trim()) return;

    // Direct to chat view if not already there
    if (view !== 'chat') {
      setView('chat');
      if (!selectedSubCategory) {
        setSelectedSubCategory(subCategory || query);
      }
    }

    const userMsg: ChatMessage = { role: 'user', text: query };
    setMessages(prev => clearPrevious ? [userMsg] : [...prev, userMsg]);
    setIsLoading(true);
    
    if (clearPrevious) {
      setAllGroundingChunks([]);
    }

    // Parallel search: Local Database + Gemini (Maps Grounding)
    try {
      const searchParams = new URLSearchParams({
        q: query,
        city_id: String(currentCity.id)
      });
      if (categoryId) searchParams.append('category_id', String(categoryId));
      if (subCategory) searchParams.append('sub_category', subCategory);

      const localResults = await fetch(`/api/search?${searchParams.toString()}`)
        .then(res => res.json())
        .catch(() => []);

      // Convert local results to GroundingChunks
      const localChunks: GroundingChunk[] = localResults
        .filter((item: any) => item.id && item.name && item.latitude)
        .map((est: any) => ({
          maps: {
            id: est.id,
            title: est.name,
            categoryId: est.category_id,
            subCategory: est.sub_category,
            cityId: est.city_id,
            address: est.address,
            hours: est.hours,
            description: est.description,
            uri: est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`,
            phone: est.phone,
            whatsapp: est.whatsapp,
            user_id: est.user_id,
            is_featured: est.is_featured,
            is_verified: est.is_verified,
            is_premium: est.is_premium,
            location: {
              latitude: est.latitude,
              longitude: est.longitude
            }
          }
        }));

      // Show local results immediately for better responsiveness
      if (localChunks.length > 0) {
        setAllGroundingChunks(prev => {
          const newChunks = localChunks.filter(
            nc => !prev.some(pc => pc.maps?.id === nc.maps?.id)
          );
          let combined = [...newChunks, ...prev];
          
          // Sort by distance if location is available
          if (location) {
            combined.sort((a, b) => {
              const locA = a.maps?.location;
              const locB = b.maps?.location;
              if (!locA || !locB) return 0;
              const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
              const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
              return distA - distB;
            });
          }
          
          return combined.slice(0, 20);
        });
        setIsMapOpen(true);
      }

      // Create context string for Gemini
      const localContext = localResults
        .filter((item: any) => item.id && item.name && item.latitude)
        .map((est: any) => `- ${est.name}: ${est.address} (${est.sub_category})`)
        .join("\n");

      const categoryName = CATEGORIES.find(c => c.id === (categoryId || activeCategoryId))?.name;
      const response = await chatWithMaps(
        query, 
        currentCity, 
        location, 
        localContext, 
        categoryName, 
        subCategory || selectedSubCategory || undefined
      );

      // If AI failed but we have local results, add a helpful message
      const aiFailed = response.isError || 
        response.text.includes("chave da API Gemini") || 
        response.text.includes("API_KEY") ||
        response.text.includes("limite de buscas gratuitas") ||
        response.text.includes("servidor da IA está temporariamente instável") ||
        response.text.includes("não consegui processar sua busca agora") ||
        response.text.includes("probleminha técnico");

      if (aiFailed) {
        if (localChunks.length > 0) {
          let reason = "nosso assistente de IA está descansando um pouquinho";
          if (response.text.includes("limite de buscas gratuitas")) reason = "o limite de buscas da IA foi atingido";
          if (response.text.includes("servidor da IA está temporariamente instável") || response.text.includes("probleminha técnico")) reason = "estamos resolvendo um pequeno probleminha técnico";

          response.text = `Encontrei **${localChunks.length} estabelecimentos** em nossa base de dados local para sua busca! ✨ \n\nEmbora ${reason}, você pode ver os locais encontrados no mapa ao lado ou na lista abaixo:\n\n` + 
            localResults.map((est: any) => `* **${est.name}**: ${est.address}`).join("\n") +
            `\n\n*(Dica: Já estamos trabalhando para resolver! Tente novamente em alguns instantes ou use as categorias)*`;
          
          // Clear error flag if we're providing a useful response with local results
          response.isError = false;
        } else {
          // No local results and AI failed
          response.text = `Puxa, não encontrei estabelecimentos para **"${query}"** em nossa base de dados local no momento. \n\nAlém disso, nosso assistente de IA está descansando um pouquinho (limite de uso). Já estamos trabalhando para que ele fique disponível o tempo todo! \n\n**Enquanto isso, que tal tentar:**\n1. Verifique se a cidade selecionada está correta.\n2. Tente uma busca mais simples (ex: apenas "Padaria").\n3. Explore as categorias acima. \n\nObrigado por sua paciência! 😊`;
        }
      }

      setMessages(prev => [...prev, response]);
      
      const geminiChunks = response.groundingChunks || [];
      
      // Try to extract descriptions from the response text for each chunk
      const chunksWithDescriptions = geminiChunks.map(chunk => {
        if (!chunk.maps) return chunk;
        
        const title = chunk.maps.title;

        // Check if this establishment is already in our local results
        const localMatch = localResults.find((lr: any) => 
          lr.name.toLowerCase().trim() === title.toLowerCase().trim()
        );

        let enrichedMaps = { ...chunk.maps };

        if (localMatch) {
          enrichedMaps = {
            ...enrichedMaps,
            id: localMatch.id,
            categoryId: localMatch.category_id,
            subCategory: localMatch.sub_category,
            address: localMatch.address || enrichedMaps.address,
            hours: localMatch.hours || enrichedMaps.hours,
            description: localMatch.description || enrichedMaps.description,
            phone: localMatch.phone || enrichedMaps.phone,
            whatsapp: localMatch.whatsapp || enrichedMaps.whatsapp,
            is_featured: localMatch.is_featured,
            is_verified: localMatch.is_verified,
            is_premium: localMatch.is_premium,
            plusCode: localMatch.plus_code || enrichedMaps.plusCode
          };
        }
        
        // Search for the title in the text and extract the following sentence/paragraph
        const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\*\\*${escapedTitle}\\*\\*:?\\s*([^\\n*]+)`, 'i');
        const match = response.text.match(regex);
        
        if (match && match[1]) {
          const content = match[1].trim();
          // Often the first part before a period or a long space is the address
          if (!enrichedMaps.address) {
            const addressMatch = content.match(/^([^.]{10,100})[.]/);
            if (addressMatch) {
              enrichedMaps.address = addressMatch[1].trim();
            }
          }
          enrichedMaps.description = enrichedMaps.description || content;
        }

        return {
          ...chunk,
          maps: enrichedMaps
        };
      });
      
      if (chunksWithDescriptions.length > 0) {
        setAllGroundingChunks(prev => {
          const newChunks = chunksWithDescriptions.filter(
            nc => !prev.some(pc => pc.maps?.title === nc.maps?.title)
          );
          let combined = [...newChunks, ...prev];
          
          // Sort by distance if location is available
          if (location) {
            combined.sort((a, b) => {
              const locA = a.maps?.location;
              const locB = b.maps?.location;
              if (!locA || !locB) return 0;
              const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
              const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
              return distA - distB;
            });
          }
          
          return combined.slice(0, 20);
        });
        setIsMapOpen(true);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, view, selectedSubCategory, currentCity, location, activeCategoryId]);

  const findNearbyEstablishments = useCallback(async () => {
    if (!location) {
      detectLocation();
      return;
    }
    
    setView('chat');
    setSelectedSubCategory('Estabelecimentos mais próximos');
    const query = `estabelecimentos mais próximos de mim em ${currentCity.name}`;
    performSearch(query, true);
  }, [location, detectLocation, currentCity, performSearch]);


  const refreshData = useCallback(() => {
    // Refresh featured
    fetch(`/api/establishments/featured?city_id=${currentCity.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // This will trigger re-render of FeaturedEstablishments if it was listening to a global state,
          // but here it's local to that component. We might need a global refresh trigger.
          window.dispatchEvent(new CustomEvent('vida360:refresh-featured'));
        }
      });
    
    // Refresh category list if active
    if (activeCategoryId) {
      fetchCategoryEstablishments(activeCategoryId);
    }
    
    // If in chat view with results, we might want to re-run the last search
    // but that could be annoying. For now, let's just clear the API cache on server
    // which we already do.
  }, [currentCity.id, activeCategoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    performSearch(input, true);
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
        
        {showSkip && (
          <button 
            onClick={skipLoading}
            className="mt-8 px-6 py-2 text-sm font-medium text-zinc-500 hover:text-[#00897b] transition-colors border border-zinc-200 rounded-full"
          >
            Pular detecção
          </button>
        )}
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
              onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-[#00897b] text-xs font-bold rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
            >
              <Plus className="w-4 h-4" />
              Sugira um Local
            </button>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{user.email}</p>
                  <div className="flex items-center justify-end gap-3">
                    <button 
                      onClick={() => setIsUserEstModalOpen(true)}
                      className="text-[10px] font-bold text-[#00897b] hover:underline transition-colors uppercase tracking-widest"
                    >
                      Meus Cadastros
                    </button>
                    {user.email === 'alcidinopk@gmail.com' && (
                      <button 
                        onClick={() => setView('maintenance')}
                        className="text-[10px] font-bold text-[#f57c00] hover:underline transition-colors uppercase tracking-widest"
                      >
                        Manutenção
                      </button>
                    )}
                    <button 
                      onClick={() => signOut()}
                      className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                      Sair
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setIsUserEstModalOpen(true)}
                  className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 border border-zinc-200 hover:bg-zinc-200 transition-all"
                >
                  <UserIcon className="w-5 h-5" />
                </button>
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
              className={`p-2 rounded-xl transition-all flex items-center gap-2 ${
                isMapOpen 
                  ? 'bg-[#00897b] text-white shadow-lg shadow-emerald-100' 
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
              title={isMapOpen ? "Fechar painel de locais" : "Abrir painel de locais"}
            >
              <MapPin className="w-5 h-5" />
              <span className="hidden xl:inline text-xs font-bold">
                {isMapOpen ? "Ocultar Locais" : "Mostrar Locais"}
              </span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative bg-white">
          <AnimatePresence mode="wait">
            {view === 'maintenance' ? (
              <motion.div
                key="maintenance"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-full bg-zinc-50 p-6"
              >
                <div className="max-w-4xl mx-auto space-y-6">
                  <button 
                    onClick={() => setView('home')}
                    className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    Voltar para o Início
                  </button>
                  <div className="grid grid-cols-1 gap-6">
                    <ExportTools />
                    <MaintenanceTools />
                  </div>
                </div>
              </motion.div>
            ) : view === 'home' ? (
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
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
                      <CitySelectorButton />
                      <button 
                        onClick={isRealLocation ? () => {
                          setIsRealLocation(false);
                          setLocation({ latitude: currentCity.latitude, longitude: currentCity.longitude });
                          setLocationName(`${currentCity.name} – ${currentCity.uf}`);
                        } : detectLocation}
                        disabled={isDetecting}
                        className={`px-4 py-2 rounded-xl transition-all border flex items-center gap-2 text-xs font-bold backdrop-blur-sm ${
                          isRealLocation 
                            ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' 
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                        } ${isDetecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isRealLocation ? "Desativar GPS e usar centro da cidade" : "Ativar minha localização real via GPS"}
                      >
                        {isDetecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isRealLocation ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Compass className="w-3 h-3" />
                        )}
                        {isRealLocation ? 'GPS Ativo' : 'Usar meu GPS'}
                      </button>
                    </div>

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
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="O que você precisa agora?"
                            className="w-full bg-transparent border-none focus:ring-0 text-zinc-900 placeholder:text-zinc-400 text-sm"
                          />
                        </div>
                        <button 
                          onClick={() => performSearch(input, true)}
                          disabled={isLoading}
                          className="px-6 py-2.5 bg-[#f57c00] text-white text-sm font-bold rounded-xl hover:bg-[#e65100] transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Buscando...</span>
                            </>
                          ) : (
                            "Buscar"
                          )}
                        </button>
                      </div>

                      <p className="mt-2 text-[10px] sm:text-xs text-white/80 italic font-medium max-w-lg mx-auto leading-relaxed">
                        "Disse-lhe Jesus: Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim." — João 14:6
                      </p>

                      {/* Intelligent Suggestions */}
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-zinc-100 overflow-hidden z-[60] p-4"
                          >
                            {input.length < 2 ? (
                              <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 block">Buscas Populares</span>
                                <div className="flex flex-wrap gap-2">
                                  <button 
                                    onClick={findNearbyEstablishments}
                                    className="px-3 py-2 bg-emerald-50 text-[#00897b] rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all border border-emerald-100 flex items-center gap-2"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    Perto de Mim
                                  </button>
                                  {["Restaurante", "Farmácia", "Açougue", "Padaria", "Oficina"].map(term => (
                                    <button 
                                      key={term}
                                      onClick={() => handleSelectSuggestion(term)}
                                      className="px-3 py-2 bg-zinc-50 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-100 transition-all border border-zinc-100 flex items-center gap-2"
                                    >
                                      <Sparkles className="w-3 h-3 text-[#f57c00]" />
                                      {term}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <>
                                {suggestions.intents.length > 0 && (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1 h-3 bg-[#f57c00] rounded-full" />
                                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Intenções Detectadas</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {suggestions.intents.map(intent => (
                                        <button 
                                          key={intent.id}
                                          onClick={() => handleSelectSuggestion(intent.name)}
                                          className="px-3 py-1.5 bg-orange-50 text-[#f57c00] rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors border border-orange-100"
                                        >
                                          {intent.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {suggestions.types.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1 h-3 bg-[#00897b] rounded-full" />
                                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sugestões de Filtro</span>
                                    </div>
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
                                {suggestions.intents.length === 0 && suggestions.types.length === 0 && (
                                  <div className="py-4 text-center">
                                    <p className="text-xs text-zinc-400 italic">Continue digitando para ver sugestões...</p>
                                  </div>
                                )}
                              </>
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
                <FeaturedEstablishments userLocation={location} />
              </motion.div>
            ) : view === 'subcategories' ? (
              /* Subcategories Screen */
              <motion.div
                key="subcategories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col bg-zinc-50"
              >
                {/* Blue Header */}
                <div className="bg-[#1a73e8] px-6 py-8 text-white relative">
                  <button 
                    onClick={handleBackToCategories}
                    className="absolute top-4 left-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-3xl font-bold mb-1">
                      {CATEGORIES.find(c => c.id === activeCategoryId)?.name}
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {CATEGORIES.find(c => c.id === activeCategoryId)?.description || "Encontre o que você precisa nesta categoria"}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                  <div className="max-w-4xl mx-auto space-y-6">
                    {/* Filter Card */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-zinc-100">
                      <h3 className="text-base font-bold text-zinc-900 mb-4">Filtrar por tipo</h3>
                      
                      <div className="flex flex-wrap gap-2">
                        {SUB_CATEGORIES.filter(sc => sc.categoryId === activeCategoryId).map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => handleSubCategoryClick(sub.name)}
                            className="px-4 py-1.5 bg-white border border-zinc-200 rounded-full text-xs font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Results Count */}
                    <div className="px-2">
                      <span className="text-sm font-medium text-zinc-500">
                        {isCategoryLoading ? "Carregando..." : `${categoryEstablishments.length} estabelecimentos encontrados`}
                      </span>
                    </div>

                    {/* Establishments List */}
                    <div className="space-y-4 pb-20">
                      {isCategoryLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                          <p className="text-sm text-zinc-400">Buscando locais...</p>
                        </div>
                      ) : categoryEstablishments.length > 0 ? (
                        categoryEstablishments.map((est) => {
                          const chunk: GroundingChunk = {
                            maps: {
                              id: est.id,
                              title: est.name,
                              uri: est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`,
                              location: {
                                latitude: est.latitude,
                                longitude: est.longitude
                              },
                              phone: est.phone,
                              whatsapp: est.whatsapp,
                              rating: est.rating,
                              address: est.address,
                              hours: est.hours,
                              categoryId: est.category_id,
                              subCategory: est.sub_category,
                              cityId: est.city_id,
                              is_featured: est.is_featured,
                              is_verified: est.is_verified,
                              is_premium: est.is_premium
                            }
                          };
                          
                          let distStr = "---";
                          if (location) {
                            const dist = calculateDistance(
                              location.latitude,
                              location.longitude,
                              est.latitude,
                              est.longitude
                            );
                            distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1)} km`;
                          }

                          return (
                            <EstablishmentCard 
                              key={est.id}
                              chunk={chunk}
                              distance={distStr}
                              userLocation={location}
                              isRealLocation={isRealLocation}
                              onRefresh={refreshData}
                            />
                          );
                        })
                      ) : (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200">
                          <p className="text-sm text-zinc-400">Nenhum estabelecimento encontrado nesta categoria.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating Action Button for Suggesting Local */}
                <button
                  onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
                  className="fixed bottom-6 right-6 w-14 h-14 bg-[#00897b] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
                  title="Sugira um Local"
                >
                  <Plus className="w-6 h-6" />
                </button>
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
                <div className="px-6 py-3 border-b border-zinc-200 bg-white flex items-center justify-between">
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
                      <h3 className="text-sm font-bold text-zinc-900">
                        {selectedSubCategory?.includes(currentCity.name) 
                          ? selectedSubCategory 
                          : `${selectedSubCategory} em ${currentCity.name}${currentCity.uf ? ` - ${currentCity.uf}` : ''}`}
                      </h3>
                    </div>
                    <button 
                      onClick={isRealLocation ? () => {
                        setIsRealLocation(false);
                        setLocation({ latitude: currentCity.latitude, longitude: currentCity.longitude });
                        setLocationName(`${currentCity.name} – ${currentCity.uf}`);
                      } : detectLocation}
                      disabled={isDetecting}
                      className={`ml-4 p-2 rounded-xl border transition-all flex items-center gap-2 text-[10px] font-bold ${
                        isRealLocation 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'
                      } ${isDetecting ? 'opacity-50' : ''}`}
                      title={isRealLocation ? "Desativar GPS" : "Ativar minha localização real via GPS"}
                    >
                      {isDetecting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : isRealLocation ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Compass className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">{isRealLocation ? 'GPS Ativo' : 'Usar meu GPS'}</span>
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => window.print()}
                      className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-500 hover:text-[#00897b] transition-colors flex items-center gap-2"
                      title="Imprimir resultados"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs font-bold">Imprimir</span>
                    </button>
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
                              ? 'bg-zinc-900 text-white' 
                              : 'bg-zinc-100 text-zinc-800 border border-zinc-200'}
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
      <motion.div 
        initial={false}
        animate={{ 
          width: isMapOpen ? (isMobile ? '100vw' : 400) : 0,
          opacity: isMapOpen ? 1 : 0,
          borderLeftWidth: isMapOpen ? 1 : 0
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={`
          ${isMapOpen ? 'fixed inset-0 z-50 bg-white lg:static lg:block' : 'hidden lg:block lg:w-0'} 
          shrink-0 border-zinc-200 overflow-hidden
        `}
      >
        {isMapOpen && (
          <button 
            onClick={() => setIsMapOpen(false)}
            className="lg:hidden absolute top-4 right-4 z-50 p-2.5 rounded-full bg-zinc-200/80 text-zinc-900 hover:bg-zinc-300 transition-all backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="w-[400px] h-full">
          <MapDisplay 
            chunks={allGroundingChunks} 
            userLocation={location} 
            isRealLocation={isRealLocation} 
            isLoading={isLoading} 
            onClose={() => setIsMapOpen(false)}
            onRefresh={refreshData}
          />
        </div>
      </motion.div>
      {/* Floating Action Button for Mobile - Suggest Local */}
      <button 
        onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
        className="md:hidden fixed bottom-24 right-6 z-40 w-14 h-14 bg-[#00897b] text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modals */}
      <RegisterEstablishmentModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
      />
      <UserEstablishmentsModal 
        isOpen={isUserEstModalOpen} 
        onClose={() => setIsUserEstModalOpen(false)} 
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </div>
  );
}
