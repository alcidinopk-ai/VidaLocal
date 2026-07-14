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
  ChevronRight,
  CheckCircle2,
  Store,
  Plus,
  Printer,
  RefreshCw,
  Mic,
  MicOff,
  User as UserIcon,
  MoreHorizontal,
  Wrench
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { chatWithMaps, ChatMessage, GroundingChunk } from './services/geminiService';
import { supabase } from './lib/supabase';
import { MapDisplay } from './components/MapDisplay';
import { EstablishmentCard } from './components/EstablishmentCard';
import { useCity } from './contexts/CityContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { CitySelectorButton } from './components/CitySelector';
import { RegisterEstablishmentModal } from './components/RegisterEstablishmentModal';
import { UserEstablishmentsModal } from './components/UserEstablishmentsModal';
import { AuthModal } from './components/AuthModal';
import { RegisterModal as RegisterUserModal } from './components/RegisterModal';
import { FeaturedEstablishments } from './components/FeaturedEstablishments';
import { NearbyEstablishments } from './components/NearbyEstablishments';
import { UserProfileModal } from './components/UserProfileModal';
import { UserManagementModal } from './components/UserManagementModal';
import { AdminClaimsModal } from './components/AdminClaimsModal';
import { AllCategoriesModal } from './components/AllCategoriesModal';
import { ResetPasswordModal } from './components/ResetPasswordModal';
import { Logo } from './components/Logo';

import { MaintenanceTools } from './components/MaintenanceTools';
import { ExportTools } from './components/ExportTools';
import { CATEGORIES, SUB_CATEGORIES } from './constants/taxonomy';
import { calculateHaversineDistance, formatDistance, sortByDistanceAsc, auditEstablishmentsCoordinates, auditUserLocationLog } from './utils/geo';

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

const isSimilarName = (name1?: string, name2?: string): boolean => {
  if (!name1 || !name2) return false;
  
  const normalize = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // remove pontuações
      .replace(/\s+/g, " ") // normaliza espaços
      .trim();
  };

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  if (n1 === n2) return true;

  const removeConnectors = (str: string) => {
    return str
      .split(" ")
      .filter(word => !["de", "da", "do", "dos", "das", "e", "o", "a", "em", "para"].includes(word))
      .join(" ");
  };

  const clean1 = removeConnectors(n1);
  const clean2 = removeConnectors(n2);

  if (clean1 === clean2) return true;

  if (clean1.length > 3 && clean2.length > 3) {
    if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
  }

  return false;
};

const calculateDistance = calculateHaversineDistance;

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

export default function App() {
  const { 
    currentCity, 
    setCity, 
    isLoading: isCityLoading, 
    skipLoading,
    selectionMode,
    gpsCity,
    isLocatingGps,
    revertToGps,
    locationPermissionStatus
  } = useCity();
  const { 
    user, 
    profile, 
    isLoading: isAuthLoading, 
    signOut, 
    isAuthModalOpen, 
    setIsAuthModalOpen,
    isRegisterUserModalOpen,
    setIsRegisterUserModalOpen,
    isResetPasswordModalOpen,
    setIsResetPasswordModalOpen
  } = useAuth();
  const [showSkip, setShowSkip] = useState(false);
  const { toast } = useToast();

  // Auth callback handling (runs in popup or redirect callback)
  const isAuthCallback = window.location.pathname === '/auth/callback';

  useEffect(() => {
    if (isAuthCallback) {
      const handleCallback = async () => {
        console.log('[Auth] Handler in callback page running...');
        try {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          console.log('[Auth] Callback success, session:', data.session ? 'Found' : 'Not found');
          
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            setTimeout(() => window.close(), 800);
          } else {
            // Clean navigation without page reload
            try { window.history.replaceState({}, document.title, '/'); } catch (e) {}
          }
        } catch (err: any) {
          console.error('[Auth] Callback error:', err);
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_ERROR', 
              error: err.message || 'Falha ao processar o login.' 
            }, '*');
            setTimeout(() => window.close(), 1500);
          } else {
            toast.error('Erro de autenticação: ' + err.message);
            setTimeout(() => {
              try { window.history.replaceState({}, document.title, '/'); } catch (e) {}
            }, 2500);
          }
        }
      };
      handleCallback();
    }
  }, [isAuthCallback]);

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
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [currentBgIndex, setCurrentBgIndex] = useState<number>(0);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [categoryEstablishments, setCategoryEstablishments] = useState<any[]>([]);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUserEstModalOpen, setIsUserEstModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isAdminClaimsModalOpen, setIsAdminClaimsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [suggestions, setSuggestions] = useState<{ intents: any[], types: string[] }>({ intents: [], types: [] });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [view, setView] = useState<'home' | 'subcategories' | 'chat' | 'maintenance'>('home');
  const [isAllCategoriesModalOpen, setIsAllCategoriesModalOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexão reestabelecida! O VidaLocal está online.");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Você está sem conexão com a internet. O VidaLocal passará a obter resultados do cache local offline.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleEstablishmentUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updated = customEvent.detail;
      if (!updated || !updated.id) return;

      const isDeleted = updated.deleted || updated.status === 'deleted';

      // 1. Update/Filter categoryEstablishments
      setCategoryEstablishments(prev => {
        if (!Array.isArray(prev)) return prev;
        if (isDeleted) {
          return prev.filter(est => est.id !== updated.id && (!updated.custom_source_mock_id || est.id !== updated.custom_source_mock_id));
        }
        return prev.map(est => {
          if (est.id === updated.id || (updated.custom_source_mock_id && est.id === updated.custom_source_mock_id)) {
            return { ...est, ...updated, id: updated.id };
          }
          return est;
        });
      });

      // 2. Update/Filter allGroundingChunks
      setAllGroundingChunks(prev => {
        if (!Array.isArray(prev)) return prev;
        if (isDeleted) {
          return prev.filter(chunk => chunk.maps?.id !== updated.id && (!updated.custom_source_mock_id || chunk.maps?.id !== updated.custom_source_mock_id));
        }
        return prev.map(chunk => {
          if (chunk.maps?.id === updated.id || (updated.custom_source_mock_id && chunk.maps?.id === updated.custom_source_mock_id)) {
            return {
              ...chunk,
              maps: {
                ...chunk.maps,
                id: updated.id,
                title: updated.name,
                uri: updated.maps_link || `https://www.google.com/maps/search/?api=1&query=${updated.latitude},${updated.longitude}`,
                location: {
                  latitude: updated.latitude,
                  longitude: updated.longitude
                },
                phone: updated.phone,
                whatsapp: updated.whatsapp,
                website: updated.website,
                description: updated.description || chunk.maps?.description,
                rating: updated.rating || chunk.maps?.rating || 5.0,
                address: updated.address,
                hours: updated.hours,
                categoryId: updated.category_id,
                subCategory: updated.sub_category,
                cityId: updated.city_id,
                is_featured: updated.is_featured,
                is_verified: updated.is_verified,
                is_premium: updated.is_premium,
                images: updated.images || chunk.maps?.images || [],
                tags: updated.tags,
                plusCode: updated.plus_code || updated.plusCode,
                instagram_url: updated.instagram_url || updated.instagramUrl,
                instagramUrl: updated.instagram_url || updated.instagramUrl,
                facebook_url: updated.facebook_url || updated.facebookUrl,
                facebookUrl: updated.facebook_url || updated.facebookUrl,
                whatsapp_url: updated.whatsapp_url || updated.whatsappUrl,
                whatsappUrl: updated.whatsapp_url || updated.whatsappUrl,
                youtube_url: updated.youtube_url || updated.youtubeUrl,
                youtubeUrl: updated.youtube_url || updated.youtubeUrl,
                tiktok_url: updated.tiktok_url || updated.tiktokUrl,
                tiktokUrl: updated.tiktok_url || updated.tiktokUrl,
                linkedin_url: updated.linkedin_url || updated.linkedinUrl,
                linkedinUrl: updated.linkedin_url || updated.linkedinUrl,
                twitter_url: updated.twitter_url || updated.twitterUrl,
                twitterUrl: updated.twitter_url || updated.twitterUrl,
                telegram_url: updated.telegram_url || updated.telegramUrl,
                telegramUrl: updated.telegram_url || updated.telegramUrl,
                google_maps_url: updated.google_maps_url || updated.googleMapsUrl,
                googleMapsUrl: updated.google_maps_url || updated.googleMapsUrl
              }
            };
          }
          return chunk;
        });
      });
    };

    window.addEventListener('vida360:establishment-updated', handleEstablishmentUpdated);
    return () => window.removeEventListener('vida360:establishment-updated', handleEstablishmentUpdated);
  }, []);

  const [isBackfilling, setIsBackfilling] = useState(false);

  const runGeoBackfillAndLoad = async () => {
    if (isBackfilling) return;
    setIsBackfilling(true);
    try {
      const res = await fetch('/api/maintenance/backfill-geo', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '' 
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.processed > 0) {
          toast.success(`${data.processed} novo(s) local(is) geocodificado(s) com sucesso. Atualizando cidades...`);
        } else {
          toast.info('Tudo atualizado! Nenhuma nova cidade/local pendente no momento.');
        }
        
        // Re-detect coordinates and load the nearest active city
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const geoRes = await fetch('/api/cities/resolve-by-geo', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                });
                if (geoRes.ok) {
                  const resolvedCity = await geoRes.json();
                  if (resolvedCity && resolvedCity.active) {
                    setCity(resolvedCity);
                    setLocation({ latitude: resolvedCity.latitude, longitude: resolvedCity.longitude });
                    setLocationName(`${resolvedCity.name} – ${resolvedCity.uf}`);
                    // Dispatch updates
                    window.dispatchEvent(new CustomEvent('vida360:refresh-featured'));
                    if (activeCategoryId) {
                      fetchCategoryEstablishments(activeCategoryId);
                    }
                  }
                }
              } catch (e) {
                console.error("Erro ao auto-detectar cidade após backfill:", e);
              }
            },
            () => {}
          );
        }
      } else {
        toast.error(`Não foi possível executar o backfill: ${data.error || 'Erro no servidor'}`);
      }
    } catch (err) {
      console.error("Backfill request error:", err);
      toast.error('Erro ao conectar ao servidor para atualizar cidades.');
    } finally {
      setIsBackfilling(false);
    }
  };

  const [isDetecting, setIsDetecting] = useState(false);

  const detectLocation = useCallback((onSuccessOrEvent?: ((loc: {latitude: number, longitude: number}) => void) | React.MouseEvent) => {
    const onSuccess = typeof onSuccessOrEvent === 'function' ? onSuccessOrEvent : undefined;
    
    setIsDetecting(true);
    // Default to city center
    const defaultLoc = {
      latitude: currentCity.latitude,
      longitude: currentCity.longitude,
    };
    
    // Try to get real location
    if (navigator.geolocation) {
      try {
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
            if (onSuccess) onSuccess(realLoc);
          },
          (error) => {
            console.warn("Error detecting real location, using city defaults:", error);
            setIsDetecting(false);
            // Use functional update to check current location state without dependency
            setLocation(prev => {
              if (!prev) {
                setIsRealLocation(false);
                setLocationName(`${currentCity.name} – ${currentCity.uf}`);
                if (onSuccess) onSuccess(defaultLoc);
                return defaultLoc;
              }
              if (onSuccess) onSuccess(prev);
              return prev;
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } catch (err) {
        console.warn("Synchronous geolocation error in App.tsx detectLocation:", err);
        setIsDetecting(false);
        setLocation(prev => {
          if (!prev) {
            setIsRealLocation(false);
            setLocationName(`${currentCity.name} – ${currentCity.uf}`);
            if (onSuccess) onSuccess(defaultLoc);
            return defaultLoc;
          }
          if (onSuccess) onSuccess(prev);
          return prev;
        });
      }
    } else {
      setIsDetecting(false);
      setLocation(prev => {
        if (!prev) {
          setIsRealLocation(false);
          setLocationName(`${currentCity.name} – ${currentCity.uf}`);
          if (onSuccess) onSuccess(defaultLoc);
          return defaultLoc;
        }
        if (onSuccess) onSuccess(prev);
        return prev;
      });
    }
  }, [currentCity]);

  const FALLBACK_CITY_IMAGES = [
    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1200&h=600&q=80",
    "https://images.unsplash.com/photo-1496568818309-53d7c7753022?auto=format&fit=crop&w=1200&h=600&q=80"
  ];

  const updateBackgroundImagesFromFeaturedData = (data: any[]) => {
    const urls: string[] = [];
    data.forEach((est: any) => {
      if (est.images) {
        if (Array.isArray(est.images)) {
          est.images.forEach((img: any) => {
            if (typeof img === 'string' && img.trim() && !urls.includes(img)) {
              urls.push(img);
            }
          });
        } else if (typeof est.images === 'string' && est.images.trim()) {
          try {
            const parsed = JSON.parse(est.images);
            if (Array.isArray(parsed)) {
              parsed.forEach((img: any) => {
                if (typeof img === 'string' && img.trim() && !urls.includes(img)) {
                  urls.push(img);
                }
              });
            }
          } catch (e) {
            if (!urls.includes(est.images)) {
              urls.push(est.images);
            }
          }
        }
      }
      if (est.image && typeof est.image === 'string' && est.image.trim() && !urls.includes(est.image)) {
        urls.push(est.image);
      }
    });

    if (urls.length > 0) {
      setBackgroundImages(urls);
    } else {
      setBackgroundImages(FALLBACK_CITY_IMAGES);
    }
    setCurrentBgIndex(0);
  };

  // Timer to rotate background images every 8 seconds
  useEffect(() => {
    const activeImages = backgroundImages.length > 0 ? backgroundImages : FALLBACK_CITY_IMAGES;
    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % activeImages.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [backgroundImages]);

  const [initialFetchError, setInitialFetchError] = useState<string | null>(null);

  // Requisito 7: Atualização Automática contínua do GPS do usuário (>= 100m)
  const lastProcessedGpsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        const last = lastProcessedGpsRef.current;
        
        // Atualiza se mudou ~100m (0.1 km) ou se for a primeira leitura de watchPosition
        if (!last || calculateHaversineDistance(last.latitude, last.longitude, newLat, newLng) >= 0.1) {
          lastProcessedGpsRef.current = { latitude: newLat, longitude: newLng };
          const realLoc = { latitude: newLat, longitude: newLng };
          setLocation(realLoc);
          setIsRealLocation(true);
          setLocationName("Minha Localização (GPS)");
          auditUserLocationLog(newLat, newLng, position.coords.accuracy, currentCity.name);
          window.dispatchEvent(new CustomEvent('vida360:location-changed', { detail: realLoc }));
        }
      },
      (err) => console.warn("GPS Watch error:", err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentCity.name]);

  useEffect(() => {
    detectLocation();
    
    // Pre-populate map with featured establishments
    setInitialFetchError(null);
    fetch(`/api/establishments/featured?city_id=${currentCity.id}`)
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`API error (${res.status}): ${text.substring(0, 50)}`);
        }
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) {
          console.warn("Featured data is not an array:", data);
          updateBackgroundImagesFromFeaturedData([]);
          return;
        }
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
            website: est.website,
            user_id: est.user_id,
            is_featured: est.is_featured,
            is_verified: est.is_verified,
            is_premium: est.is_premium,
            opening_hours: est.opening_hours,
            images: est.images || [],
            tags: est.tags,
            plusCode: est.plus_code || est.plusCode,
            instagram_url: est.instagram_url || est.instagramUrl,
            instagramUrl: est.instagram_url || est.instagramUrl,
            facebook_url: est.facebook_url || est.facebookUrl,
            facebookUrl: est.facebook_url || est.facebookUrl,
            whatsapp_url: est.whatsapp_url || est.whatsappUrl,
            whatsappUrl: est.whatsapp_url || est.whatsappUrl,
            youtube_url: est.youtube_url || est.youtubeUrl,
            youtubeUrl: est.youtube_url || est.youtubeUrl,
            tiktok_url: est.tiktok_url || est.tiktokUrl,
            tiktokUrl: est.tiktok_url || est.tiktokUrl,
            linkedin_url: est.linkedin_url || est.linkedinUrl,
            linkedinUrl: est.linkedin_url || est.linkedinUrl,
            twitter_url: est.twitter_url || est.twitterUrl,
            twitterUrl: est.twitter_url || est.twitterUrl,
            telegram_url: est.telegram_url || est.telegramUrl,
            telegramUrl: est.telegram_url || est.telegramUrl,
            google_maps_url: est.google_maps_url || est.googleMapsUrl,
            googleMapsUrl: est.google_maps_url || est.googleMapsUrl,
            location: {
              latitude: est.latitude,
              longitude: est.longitude
            }
          }
        }));
        setAllGroundingChunks(initialChunks);
        updateBackgroundImagesFromFeaturedData(data);
      })
      .catch(err => {
        console.error("Error fetching initial establishments:", err);
        setInitialFetchError("Não foi possível carregar os estabelecimentos. Verifique sua conexão.");
        updateBackgroundImagesFromFeaturedData([]);
      });
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
      
      if (Array.isArray(data)) {
        data.sort((a, b) => {
          // 1. Distance priority (if location is available)
          if (location) {
            const distA = calculateDistance(location.latitude, location.longitude, a.latitude, a.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, b.latitude, b.longitude);
            if (isFinite(distA) && isFinite(distB)) return distA - distB;
            if (isFinite(distA) && !isFinite(distB)) return -1;
            if (!isFinite(distA) && isFinite(distB)) return 1;
          }

          // 2. Premium priority
          const premiumA = a.is_premium ? 1 : 0;
          const premiumB = b.is_premium ? 1 : 0;
          if (premiumA !== premiumB) return premiumB - premiumA;
          
          // 3. Featured priority
          const featuredA = a.is_featured ? 1 : 0;
          const featuredB = b.is_featured ? 1 : 0;
          if (featuredA !== featuredB) return featuredB - featuredA;

          return 0;
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
          if (isFinite(distA) && isFinite(distB)) return distA - distB;
          if (isFinite(distA) && !isFinite(distB)) return -1;
          if (!isFinite(distA) && isFinite(distB)) return 1;

          const premiumA = a.is_premium ? 1 : 0;
          const premiumB = b.is_premium ? 1 : 0;
          if (premiumA !== premiumB) return premiumB - premiumA;
          
          const featuredA = a.is_featured ? 1 : 0;
          const featuredB = b.is_featured ? 1 : 0;
          if (featuredA !== featuredB) return featuredB - featuredA;

          return 0;
        });
        return sorted;
      });

      setAllGroundingChunks(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const sorted = [...prev].sort((a, b) => {
          const am = a.maps;
          const bm = b.maps;
          
          const locA = am?.location;
          const locB = bm?.location;
          if (locA && locB) {
            const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
            const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
            if (isFinite(distA) && isFinite(distB)) return distA - distB;
            if (isFinite(distA) && !isFinite(distB)) return -1;
            if (!isFinite(distA) && isFinite(distB)) return 1;
          }
          
          const premiumA = am?.is_premium ? 1 : 0;
          const premiumB = bm?.is_premium ? 1 : 0;
          if (premiumA !== premiumB) return premiumB - premiumA;
          
          const featuredA = am?.is_featured ? 1 : 0;
          const featuredB = bm?.is_featured ? 1 : 0;
          if (featuredA !== featuredB) return featuredB - featuredA;

          return 0;
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

    // Offline mode support
    if (!navigator.onLine) {
      const cachedDataStr = localStorage.getItem('vida360_last_search_cache');
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          toast.info(`Você está sem conexão com a internet. Exibindo os últimos resultados salvos para: "${cachedData.query}".`);
          setMessages(cachedData.messages);
          setAllGroundingChunks(cachedData.allGroundingChunks);
          setView('chat');
          setIsMapOpen(true);
        } catch (parseErr) {
          toast.error("Não foi possível carregar os resultados salvos no cache offline.");
        }
      } else {
        toast.error("Você está sem conexão com a internet e não há buscas salvas anteriores.");
      }
      return;
    }

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

    try {
      let cacheChunks: GroundingChunk[] = [];
      const searchParams = new URLSearchParams({
        q: query,
        city_id: String(currentCity.id)
      });
      if (categoryId) searchParams.append('category_id', String(categoryId));
      if (subCategory) searchParams.append('sub_category', subCategory);

      // 1. Fetch Local Database Results (FAST)
      const localResultsPromise = fetch(`/api/search?${searchParams.toString()}`)
        .then(res => res.json())
        .catch(() => []);

      // Add a preliminary message to the chat so the user sees progress
      const initialResponse: ChatMessage = {
        role: 'model',
        text: `Buscando **"${query}"** em ${currentCity.name}...`
      };
      setMessages(prev => [...prev, initialResponse]);

      const localResults = await localResultsPromise;

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
            website: est.website,
            user_id: est.user_id,
            is_featured: est.is_featured,
            is_verified: est.is_verified,
            is_premium: est.is_premium,
            opening_hours: est.opening_hours,
            images: est.images || [],
            tags: est.tags,
            plusCode: est.plus_code || est.plusCode,
            instagram_url: est.instagram_url || est.instagramUrl,
            instagramUrl: est.instagram_url || est.instagramUrl,
            facebook_url: est.facebook_url || est.facebookUrl,
            facebookUrl: est.facebook_url || est.facebookUrl,
            whatsapp_url: est.whatsapp_url || est.whatsappUrl,
            whatsappUrl: est.whatsapp_url || est.whatsappUrl,
            youtube_url: est.youtube_url || est.youtubeUrl,
            youtubeUrl: est.youtube_url || est.youtubeUrl,
            tiktok_url: est.tiktok_url || est.tiktokUrl,
            tiktokUrl: est.tiktok_url || est.tiktokUrl,
            linkedin_url: est.linkedin_url || est.linkedinUrl,
            linkedinUrl: est.linkedin_url || est.linkedinUrl,
            twitter_url: est.twitter_url || est.twitterUrl,
            twitterUrl: est.twitter_url || est.twitterUrl,
            telegram_url: est.telegram_url || est.telegramUrl,
            telegramUrl: est.telegram_url || est.telegramUrl,
            google_maps_url: est.google_maps_url || est.googleMapsUrl,
            googleMapsUrl: est.google_maps_url || est.googleMapsUrl,
            location: {
              latitude: est.latitude,
              longitude: est.longitude
            }
          }
        }));

      // Show local results immediately in the map
      if (localChunks.length > 0) {
        cacheChunks = [...localChunks];
        setAllGroundingChunks(prev => {
          // Prioritize newChunks that have data from our DB
          const filteredPrev = prev.filter(
            pc => !localChunks.some(nc => nc.maps?.id === pc.maps?.id || isSimilarName(nc.maps?.title, pc.maps?.title))
          );
          let combined = [...localChunks, ...filteredPrev];
          combined.sort((a, b) => {
            const am = a.maps;
            const bm = b.maps;
            
            if (location) {
              const locA = am?.location;
              const locB = bm?.location;
              if (locA && locB) {
                const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
                const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
                if (isFinite(distA) && isFinite(distB)) return distA - distB;
                if (isFinite(distA) && !isFinite(distB)) return -1;
                if (!isFinite(distA) && isFinite(distB)) return 1;
              }
            }
            
            const premiumA = am?.is_premium ? 1 : 0;
            const premiumB = bm?.is_premium ? 1 : 0;
            if (premiumA !== premiumB) return premiumB - premiumA;
            
            const featuredA = am?.is_featured ? 1 : 0;
            const featuredB = bm?.is_featured ? 1 : 0;
            if (featuredA !== featuredB) return featuredB - featuredA;

            return 0;
          });
          return combined.slice(0, 30);
        });
        setIsMapOpen(true);
        
        // Update preliminary message
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
            newMessages[newMessages.length - 1].text = `Encontrei **${localChunks.length}** locais em nossa base de dados. Estou buscando mais detalhes com a IA...`;
          }
          return newMessages;
        });
      }

      // 2. Call Gemini (SLOWER, but now with STREAMING)
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
        subCategory || selectedSubCategory || undefined,
        (streamedText) => {
          // Update the last message as it streams
          setMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                text: streamedText
              };
            }
            return newMessages;
          });
        }
      );

      // Handle AI failure/quota
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

          response.text = `Em **${currentCity.name} - ${currentCity.uf}**, você pode encontrar os seguintes estabelecimentos que oferecem serviços de **${query}**:\n\n` + 
            localResults.map((est: any) => `* **${est.name}**: ${est.address}`).join("\n") +
            `\n\n*(Nota: ${reason}. Já estamos trabalhando para que ele fique disponível o tempo todo!)*`;
          response.isError = false;
        } else {
          // GPS Fallback if everything failed
          try {
            const fallbackRes = await fetch(`/api/search?q=&city_id=${currentCity.id}`);
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              const nearbyChunks: GroundingChunk[] = fallbackData.map((est: any) => ({
                maps: {
                  id: est.id, title: est.name, categoryId: est.category_id, subCategory: est.sub_category,
                  cityId: est.city_id, address: est.address, hours: est.hours, description: est.description,
                  uri: est.maps_link || `https://www.google.com/maps/search/?api=1&query=${est.latitude},${est.longitude}`,
                  phone: est.phone, whatsapp: est.whatsapp, website: est.website, user_id: est.user_id, is_featured: est.is_featured,
                  is_verified: est.is_verified, is_premium: est.is_premium, opening_hours: est.opening_hours,
                  images: est.images || [],
                  tags: est.tags,
                  plusCode: est.plus_code || est.plusCode,
                  instagram_url: est.instagram_url || est.instagramUrl,
                  instagramUrl: est.instagram_url || est.instagramUrl,
                  facebook_url: est.facebook_url || est.facebookUrl,
                  facebookUrl: est.facebook_url || est.facebookUrl,
                  whatsapp_url: est.whatsapp_url || est.whatsappUrl,
                  whatsappUrl: est.whatsapp_url || est.whatsappUrl,
                  youtube_url: est.youtube_url || est.youtubeUrl,
                  youtubeUrl: est.youtube_url || est.youtubeUrl,
                  tiktok_url: est.tiktok_url || est.tiktokUrl,
                  tiktokUrl: est.tiktok_url || est.tiktokUrl,
                  linkedin_url: est.linkedin_url || est.linkedinUrl,
                  linkedinUrl: est.linkedin_url || est.linkedinUrl,
                  twitter_url: est.twitter_url || est.twitterUrl,
                  twitterUrl: est.twitter_url || est.twitterUrl,
                  telegram_url: est.telegram_url || est.telegramUrl,
                  telegramUrl: est.telegram_url || est.telegramUrl,
                  google_maps_url: est.google_maps_url || est.googleMapsUrl,
                  googleMapsUrl: est.google_maps_url || est.googleMapsUrl,
                  location: { latitude: est.latitude, longitude: est.longitude }
                }
              }));
              if (location) {
                nearbyChunks.sort((a, b) => {
                  const distA = calculateDistance(location.latitude, location.longitude, a.maps?.location?.latitude, a.maps?.location?.longitude);
                  const distB = calculateDistance(location.latitude, location.longitude, b.maps?.location?.latitude, b.maps?.location?.longitude);
                  if (distA !== distB && isFinite(distA) && isFinite(distB)) return distA - distB;
                  if (isFinite(distA) && !isFinite(distB)) return -1;
                  if (!isFinite(distA) && isFinite(distB)) return 1;
                  return 0;
                });
              }
              cacheChunks = nearbyChunks.slice(0, 5);
              setAllGroundingChunks(nearbyChunks.slice(0, 5));
              setIsMapOpen(true);
              response.text = `Puxa, não encontrei estabelecimentos para **"${query}"** no momento. \n\nComo nosso assistente de IA também está temporariamente indisponível, utilizei seu GPS para encontrar os **locais mais próximos de você** em ${currentCity.name}.`;
              response.isError = false;
            }
          } catch (e) {}
        }
      }

      // Replace the preliminary message with the final AI response
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'model') {
          newMessages[newMessages.length - 1] = response;
        } else {
          newMessages.push(response);
        }
        return newMessages;
      });
      
      const geminiChunks = response.groundingChunks || [];
      const chunksWithDescriptions = geminiChunks.map(chunk => {
        if (!chunk.maps) return chunk;
        const title = chunk.maps.title;
        const localMatch = localResults.find((lr: any) => isSimilarName(lr.name, title));
        let enrichedMaps = { ...chunk.maps };
        if (localMatch) {
          enrichedMaps = {
            ...enrichedMaps, id: localMatch.id, categoryId: localMatch.category_id, subCategory: localMatch.sub_category,
            address: localMatch.address || enrichedMaps.address, hours: localMatch.hours || enrichedMaps.hours,
            description: localMatch.description || enrichedMaps.description, phone: localMatch.phone || enrichedMaps.phone,
            whatsapp: localMatch.whatsapp || enrichedMaps.whatsapp, website: localMatch.website || enrichedMaps.website, is_featured: localMatch.is_featured,
            is_verified: localMatch.is_verified, is_premium: localMatch.is_premium, plusCode: localMatch.plus_code || enrichedMaps.plusCode,
            images: localMatch.images || enrichedMaps.images || [],
            location: {
              latitude: Number(localMatch.latitude),
              longitude: Number(localMatch.longitude)
            }
          };
        }
        const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\*\\*${escapedTitle}\\*\\*:?\\s*([^\\n*]+)`, 'i');
        const match = response.text.match(regex);
        if (match && match[1]) {
          const content = match[1].trim();
          if (!enrichedMaps.address) {
            const addressMatch = content.match(/^([^.]{10,100})[.]/);
            if (addressMatch) enrichedMaps.address = addressMatch[1].trim();
          }
          enrichedMaps.description = enrichedMaps.description || content;
        }
        return { ...chunk, maps: enrichedMaps };
      });
      
      if (chunksWithDescriptions.length > 0) {
        // Merge chunksWithDescriptions with localChunks so we have all of them
        const mergedCache = [...chunksWithDescriptions];
        localChunks.forEach(lc => {
          if (!mergedCache.some(mc => mc.maps?.id === lc.maps?.id || isSimilarName(mc.maps?.title, lc.maps?.title))) {
            mergedCache.push(lc);
          }
        });
        cacheChunks = mergedCache;

        setAllGroundingChunks(prev => {
          const newChunks = chunksWithDescriptions.filter(nc => !prev.some(pc => isSimilarName(pc.maps?.title, nc.maps?.title)));
          let combined = [...newChunks, ...prev];
          combined.sort((a, b) => {
            const am = a.maps;
            const bm = b.maps;
            
            if (location) {
              const locA = am?.location;
              const locB = bm?.location;
              if (locA && locB) {
                const distA = calculateDistance(location.latitude, location.longitude, locA.latitude, locA.longitude);
                const distB = calculateDistance(location.latitude, location.longitude, locB.latitude, locB.longitude);
                if (isFinite(distA) && isFinite(distB)) return distA - distB;
                if (isFinite(distA) && !isFinite(distB)) return -1;
                if (!isFinite(distA) && isFinite(distB)) return 1;
              }
            }
            
            const premiumA = am?.is_premium ? 1 : 0;
            const premiumB = bm?.is_premium ? 1 : 0;
            if (premiumA !== premiumB) return premiumB - premiumA;
            
            const featuredA = am?.is_featured ? 1 : 0;
            const featuredB = bm?.is_featured ? 1 : 0;
            if (featuredA !== featuredB) return featuredB - featuredA;

            return 0;
          });
          return combined.slice(0, 30);
        });
        setIsMapOpen(true);
      }

      // Save last search to LocalStorage Cache
      try {
        const finalCachedChunks = cacheChunks.length > 0 ? cacheChunks : (localChunks.length > 0 ? localChunks : []);
        const cacheObj = {
          query,
          messages: clearPrevious 
            ? [{ role: 'user', text: query }, response]
            : [...messages, { role: 'user', text: query }, response],
          allGroundingChunks: finalCachedChunks,
          timestamp: Date.now(),
          cityId: currentCity.id,
          cityName: currentCity.name,
          cityUf: currentCity.uf
        };
        localStorage.setItem('vida360_last_search_cache', JSON.stringify(cacheObj));
        console.log(`[Cache] Successfully cached last search "${query}" with ${finalCachedChunks.length} chunks.`);
      } catch (cacheErr) {
        console.warn("[Cache] Failed to save search to LocalStorage:", cacheErr);
      }

    } catch (err) {
      console.error("Search error:", err);
      
      const cachedDataStr = localStorage.getItem('vida360_last_search_cache');
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          toast.info(`Houve uma falha na conexão. Exibindo resultados offline salvos de sua última busca: "${cachedData.query}".`);
          setMessages(cachedData.messages);
          setAllGroundingChunks(cachedData.allGroundingChunks);
          setView('chat');
          setIsMapOpen(true);
        } catch (parseErr) {
          toast.error("Não foi possível carregar os resultados offline salvos.");
        }
      } else {
        toast.error("Não foi possível realizar a busca e não há resultados salvos em cache.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, view, selectedSubCategory, currentCity, location, activeCategoryId]);

  const toggleListening = useCallback((isChatInput: boolean = false) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.warning("O seu navegador não possui suporte para reconhecimento de voz (Web Speech API). Tente utilizar o Google Chrome, Edge ou Safari.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput(transcript);
        if (!isChatInput) {
          performSearch(transcript, true);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  }, [isListening, performSearch]);

  const findNearbyEstablishments = useCallback(async () => {
    setShowSuggestions(false);
    const runSearch = async (loc: {latitude: number, longitude: number}) => {
      setView('chat');
      setSelectedSubCategory('Estabelecimentos mais próximos');
      setIsLoading(true);
      
      try {
        const res = await fetch(`/api/search?q=&city_id=${currentCity.id}`);
        const data = await res.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          setMessages(prev => [...prev, {
            role: 'model',
            text: `Não foram encontrados estabelecimentos cadastrados em ${currentCity.name}.`
          }]);
          setIsLoading(false);
          return;
        }

        // Auditoria das coordenadas (Requisito 1)
        auditEstablishmentsCoordinates(data, currentCity);

        // Ordenar rigorosamente por distância crescente sem desempates secundários (Requisito 4 e 5)
        const sorted = sortByDistanceAsc(data, loc.latitude, loc.longitude).filter(e => isFinite(e.distance));
        
        // Log temporário no console (Requisito 2 e 9)
        auditUserLocationLog(loc.latitude, loc.longitude, undefined, currentCity.name, {
          analyzedCount: sorted.length,
          sampleDistances: sorted.slice(0, 5).map(e => `${e.name}: ${e.formattedDistance}`)
        });

        // Expansão de raio automática: 500 m -> 1 km -> 2 km -> 5 km -> 10 km -> toda a cidade (Requisito 5)
        const radiuses = [0.5, 1, 2, 5, 10, Infinity];
        let foundRadius = Infinity;
        let filtered = sorted;
        
        for (const r of radiuses) {
          const inRadius = sorted.filter(e => e.distance <= r);
          if (inRadius.length > 0) {
            foundRadius = r;
            filtered = inRadius;
            break;
          }
        }

        let noticeMsg = "";
        if (foundRadius > 0.5 && foundRadius !== Infinity) {
          noticeMsg = `\n\n⚠️ *Nenhum estabelecimento foi encontrado em até 500 m. O raio de busca foi ampliado automaticamente para ${foundRadius} km para mostrar as opções mais próximas!*`;
          toast.info(`Raio ampliado para ${foundRadius} km`, 5000);
        } else if (foundRadius === Infinity && sorted.length > 0 && sorted[0].distance > 0.5) {
          noticeMsg = `\n\n⚠️ *Nenhum estabelecimento foi encontrado no raio inicial. Exibindo os estabelecimentos disponíveis na cidade por ordem de proximidade.*`;
          toast.info(`Exibindo locais por proximidade em toda a cidade`, 5000);
        }

        const chunks: GroundingChunk[] = filtered.map(est => ({
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
            website: est.website,
            user_id: est.user_id,
            is_featured: est.is_featured,
            is_verified: est.is_verified,
            is_premium: est.is_premium,
            opening_hours: est.opening_hours,
            images: est.images || [],
            tags: est.tags,
            plusCode: est.plus_code || est.plusCode,
            instagram_url: est.instagram_url || est.instagramUrl,
            instagramUrl: est.instagram_url || est.instagramUrl,
            facebook_url: est.facebook_url || est.facebookUrl,
            facebookUrl: est.facebook_url || est.facebookUrl,
            whatsapp_url: est.whatsapp_url || est.whatsappUrl,
            whatsappUrl: est.whatsapp_url || est.whatsappUrl,
            youtube_url: est.youtube_url || est.youtubeUrl,
            youtubeUrl: est.youtube_url || est.youtubeUrl,
            tiktok_url: est.tiktok_url || est.tiktokUrl,
            tiktokUrl: est.tiktok_url || est.tiktokUrl,
            linkedin_url: est.linkedin_url || est.linkedinUrl,
            linkedinUrl: est.linkedin_url || est.linkedinUrl,
            twitter_url: est.twitter_url || est.twitterUrl,
            twitterUrl: est.twitter_url || est.twitterUrl,
            telegram_url: est.telegram_url || est.telegramUrl,
            telegramUrl: est.telegram_url || est.telegramUrl,
            google_maps_url: est.google_maps_url || est.googleMapsUrl,
            googleMapsUrl: est.google_maps_url || est.googleMapsUrl,
            location: { latitude: est.latitude, longitude: est.longitude }
          }
        }));

        setAllGroundingChunks(chunks);
        setIsMapOpen(true);

        const listText = filtered.slice(0, 12).map((est, idx) => `**${idx + 1}º — ${est.name}** (${est.formattedDistance})\n📍 Endereço: ${est.address}`).join("\n\n");
        
        setMessages(prev => [...prev, {
          role: 'model',
          text: `📍 **Estabelecimentos Mais Próximos de Você em ${currentCity.name}:**\n\n${listText}${noticeMsg}`,
          groundingChunks: chunks
        }]);
      } catch (err) {
        console.error("Erro no Perto de Mim:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (!location) {
      detectLocation(runSearch);
      return;
    }
    
    runSearch(location);
  }, [location, detectLocation, currentCity, setShowSuggestions, toast]);


  const refreshData = useCallback(() => {
    // Refresh featured
    fetch(`/api/establishments/featured?city_id=${currentCity.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          // This will trigger re-render of FeaturedEstablishments if it was listening to a global state,
          // but here it's local to that component. We might need a global refresh trigger.
          window.dispatchEvent(new CustomEvent('vida360:refresh-featured'));
          updateBackgroundImagesFromFeaturedData(data);
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

  if (isAuthCallback) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-50 p-6 text-center">
        <div className="w-16 h-16 bg-[#f57c00] rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg animate-bounce">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Autenticando...</h2>
        <p className="text-zinc-500 max-w-xs mx-auto">Por favor, aguarde enquanto finalizamos sua identificação.</p>
      </div>
    );
  }

  if (isAuthLoading || isCityLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-white p-6 text-center">
        <Logo layout="vertical" size="lg" className="mb-6 animate-pulse" />
        <p className="text-sm text-zinc-400 mt-2">
          {isAuthLoading ? 'Recuperando sua sessão...' : 'Detectando sua localização...'}
        </p>
        
        {isCityLoading && showSkip && (
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
        <header className="h-16 border-b border-zinc-200 flex items-center justify-between px-4 sm:px-6 bg-white z-20">
          <Logo layout="horizontal" size="sm" />
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
              className="flex items-center justify-center gap-1.5 bg-emerald-600 text-white font-bold rounded-full sm:rounded-xl hover:bg-emerald-700 transition-all border border-emerald-500 shadow-md active:scale-95 shrink-0 w-8 h-8 sm:w-auto sm:h-auto sm:px-4 sm:py-2 text-xs"
              title="Sugira um Local"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Sugira um Local</span>
            </button>

            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-1.5 sm:gap-3 text-left hover:opacity-90 transition-opacity focus:outline-none"
                >
                  <div className="text-right flex flex-col justify-center max-w-[65px] sm:max-w-[150px]">
                    <p className="text-[10px] sm:text-xs font-bold text-zinc-900 truncate">
                      {profile?.full_name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[9px] text-zinc-400 truncate hidden sm:block">
                      {user.email}
                    </p>
                  </div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all shrink-0">
                    <UserIcon className="w-4 h-4 sm:w-5 h-5" />
                  </div>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white border border-zinc-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-zinc-100 sm:hidden">
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {profile?.full_name || user.email?.split('@')[0]}
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setIsProfileModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Meu Perfil</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsUserEstModalOpen(true);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Meus Locais</span>
                    </button>

                    {user.email === 'alcidinopk@gmail.com' && (
                      <>
                        <div className="border-t border-zinc-100 my-1"></div>
                        <div className="px-4 py-1 text-[8px] font-bold text-zinc-400 tracking-wider uppercase">
                          Administração
                        </div>
                        <button
                          onClick={() => {
                            setIsUserManagementModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#00897b] hover:bg-[#00897b]/5 transition-colors flex items-center gap-2"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Usuários</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsAdminClaimsModalOpen(true);
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#e65100] hover:bg-[#e65100]/5 transition-colors flex items-center gap-2"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Reivindicações</span>
                        </button>
                        <button
                          onClick={() => {
                            setView('maintenance');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-[#f57c00] hover:bg-[#f57c00]/5 transition-colors flex items-center gap-2"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Manutenção</span>
                        </button>
                      </>
                    )}

                    <div className="border-t border-zinc-100 my-1"></div>
                    
                    <button
                      onClick={() => {
                        signOut();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="px-3 sm:px-6 py-1.5 sm:py-2 bg-zinc-900 text-white text-[11px] sm:text-xs font-bold rounded-xl hover:bg-zinc-800 transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm shrink-0"
              >
                <UserIcon className="w-4 h-4" />
                Entrar
              </button>
            )}
            
            <button 
              onClick={() => setIsMapOpen(!isMapOpen)}
              className={`hidden sm:flex p-2 rounded-xl transition-all items-center gap-2 ${
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
          {initialFetchError && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="bg-red-500 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium">
                <X className="w-4 h-4 cursor-pointer" onClick={() => setInitialFetchError(null)} />
                {initialFetchError}
              </div>
            </div>
          )}
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
                {/* Hero, Search & Categories Container with Gradient styling */}
                <div className="relative flex flex-col items-center justify-start px-4 sm:px-6 py-8 text-center overflow-hidden bg-zinc-50 border-b border-zinc-100">
                  
                  {/* 1. Light Gray Base Background Layer */}
                  <div className="absolute inset-0 bg-[#f4f4f7] z-0 pointer-events-none" />
                  
                  {/* 2. Dynamic City Establishments Background (Intermediate Layer) */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={backgroundImages[currentBgIndex] || 'fallback-bg-' + currentBgIndex}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 0.85, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 1.8, ease: "easeInOut" }}
                        className="absolute inset-0"
                      >
                        <img
                          src={backgroundImages[currentBgIndex] || FALLBACK_CITY_IMAGES[currentBgIndex % FALLBACK_CITY_IMAGES.length]}
                          alt="Cidade Viva"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  
                  {/* 3. Smooth fade-out light-gray overlays for clean transition & maximum text readability */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-[#f4f4f7]/85 to-[#f4f4f7] z-0 pointer-events-none" />
                  <div className="absolute inset-0 bg-white/10 z-0 pointer-events-none" />
                  
                  <div className="relative z-10 max-w-4xl mx-auto w-full">
                    
                    {/* 1. Barra Superior */}
                    <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
                      {/* GPS Pill Button */}
                      <button 
                        onClick={isRealLocation ? () => {
                          setIsRealLocation(false);
                          setLocation({ latitude: currentCity.latitude, longitude: currentCity.longitude });
                          setLocationName(`${currentCity.name} – ${currentCity.uf}`);
                        } : detectLocation}
                        disabled={isDetecting}
                        className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 text-xs font-bold backdrop-blur-md border cursor-pointer select-none shrink-0 shadow-xs ${
                          isRealLocation 
                            ? 'bg-emerald-600 border-emerald-500 text-white' 
                            : 'bg-white/80 hover:bg-white text-zinc-800 border-zinc-200/80 shadow-xs'
                        } ${isDetecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isRealLocation ? "Desativar GPS e usar centro da cidade" : "Ativar GPS real"}
                      >
                        {isDetecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                        ) : isRealLocation ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 fill-emerald-500/20" />
                        ) : (
                          <Compass className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        {isRealLocation ? 'GPS Ativo' : 'Usar meu GPS'}
                      </button>

                      {/* Seletor de Cidade */}
                      <CitySelectorButton />

                      {/* Botão Atualizar Localização */}
                      <button
                        onClick={runGeoBackfillAndLoad}
                        disabled={isBackfilling}
                        className="p-2 bg-white/80 hover:bg-white text-zinc-700 border border-zinc-200/80 rounded-full transition-all flex items-center justify-center shrink-0 shadow-xs cursor-pointer backdrop-blur-md"
                        title="Atualizar localização"
                      >
                        {isBackfilling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Smart Current City Detection Display (Sprint 2.3) */}
                    <div className="mb-6 flex flex-col items-center justify-center">
                      {isLocatingGps ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs font-bold rounded-2xl animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          Obtendo localização pelo GPS...
                        </div>
                      ) : selectionMode === 'gps' ? (
                        <div className="inline-flex flex-col items-center justify-center px-6 py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-xs select-none">
                          <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                            <span className="animate-pulse flex h-1.5 w-1.5 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                            </span>
                            📍 Você está em
                          </div>
                          <div className="text-zinc-900 font-extrabold text-xl sm:text-2xl mt-1 tracking-tight">
                            {currentCity.name} - {currentCity.uf}
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center justify-center px-6 py-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-xs lg:hover:shadow-md transition-all select-none">
                          <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold uppercase tracking-wider">
                            📍 Você está em {gpsCity ? `(GPS: ${gpsCity.name})` : ''}
                          </div>
                          <div className="text-zinc-900 font-extrabold text-xl sm:text-2xl mt-1 tracking-tight">
                            {currentCity.name} - {currentCity.uf}
                          </div>
                          <button
                            onClick={revertToGps}
                            disabled={isLocatingGps}
                            className="mt-2.5 px-3 py-1 bg-white hover:bg-zinc-50 text-emerald-700 hover:text-emerald-800 font-bold text-xs border border-zinc-200 rounded-full transition-all flex items-center gap-1 shadow-xs shrink-0 cursor-pointer"
                          >
                            <Compass className="w-3 h-3 text-emerald-600 animate-pulse" />
                            Voltar para minha localização
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Offline Banner & Cache Restoration (Sprint 2.4 Cache) */}
                    {!isOnline && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8 p-4 bg-zinc-800 text-white rounded-2xl max-w-md mx-auto shadow-sm select-none border border-zinc-700 text-center"
                      >
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider justify-center">
                          <Globe className="w-4 h-4 text-amber-400 animate-pulse" />
                          Modo Offline Ativo
                        </div>
                        <p className="text-zinc-300 text-xs mt-1.5 leading-relaxed font-semibold">
                          Você está desconectado da internet. É possível visualizar os locais salvos em cache da sua última busca realizada.
                        </p>
                        {localStorage.getItem('vida360_last_search_cache') && (
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                const cachedDataStr = localStorage.getItem('vida360_last_search_cache');
                                if (cachedDataStr) {
                                  try {
                                    const cachedData = JSON.parse(cachedDataStr);
                                    setMessages(cachedData.messages);
                                    setAllGroundingChunks(cachedData.allGroundingChunks);
                                    setView('chat');
                                    setIsMapOpen(true);
                                    toast.info(`Busca offline restaurada: "${cachedData.query}"`);
                                  } catch (e) {
                                    toast.error("Erro ao carregar cache.");
                                  }
                                }
                              }}
                              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-zinc-900 font-extrabold text-xs rounded-full transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                            >
                              <Search className="w-3.5 h-3.5 text-zinc-900" />
                              Ver Última Busca ("{JSON.parse(localStorage.getItem('vida360_last_search_cache') || '{}').query || ''}")
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Logo Branded Display */}
                    <Logo 
                      layout="vertical" 
                      size="lg" 
                      showSubtitle={true} 
                      className="mb-6" 
                      subtitleClassName="text-zinc-800 text-xs sm:text-sm font-semibold max-w-xl mx-auto leading-relaxed drop-shadow-[0_1px_5px_rgba(255,255,255,0.5)] !text-zinc-700"
                    />

                    {/* 4. Campo de Busca Inteligente */}
                    <div ref={searchContainerRef} className="relative max-w-xl mx-auto w-full mb-2">
                      <div className="bg-white p-1.5 rounded-2xl shadow-xl flex items-center gap-2 border border-zinc-200/40">
                        <div className="flex-1 flex items-center gap-2 pl-3">
                          <Search className="w-4 h-4 text-zinc-400" />
                          <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && performSearch(input, true)}
                            onFocus={() => setShowSuggestions(true)}
                            placeholder="O que você procura agora?"
                            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-zinc-900 placeholder:text-zinc-400 text-xs sm:text-sm py-2 font-medium"
                          />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => toggleListening(false)}
                          className={`p-2 rounded-xl sm:p-2.5 transition-all relative flex items-center justify-center shrink-0 cursor-pointer ${
                            isListening 
                              ? 'bg-red-50 text-red-600 animate-pulse border border-red-200' 
                              : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                          }`}
                          title={isListening ? "Desativar busca por voz" : "Buscar por voz (fale agora)"}
                        >
                          {isListening ? (
                            <MicOff className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                          ) : (
                            <Mic className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                          )}
                          {isListening && (
                            <span className="absolute -inset-0.5 rounded-xl bg-red-500/20 animate-ping pointer-events-none" />
                          )}
                        </button>

                        <button 
                          onClick={() => performSearch(input, true)}
                          disabled={isLoading}
                          className="px-4 sm:px-6 py-2.5 bg-[#f57c00] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#e65100] transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shrink-0"
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

                      {/* Intelligent Suggestions List */}
                      <AnimatePresence>
                        {showSuggestions && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 right-0 mt-3 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-zinc-200 overflow-y-auto max-h-[60vh] lg:max-h-[none] z-[60] p-4 sm:p-6 text-left"
                          >
                            {input.length < 2 ? (
                              <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-4 block">Buscas Populares</span>
                                <div className="flex flex-wrap gap-2">
                                  <button 
                                    onClick={findNearbyEstablishments}
                                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all border border-emerald-500 flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                    Perto de Mim
                                  </button>
                                  {["Restaurante", "Farmácia", "Açougue", "Padaria", "Oficina"].map(term => (
                                    <button 
                                      key={term}
                                      onClick={() => handleSelectSuggestion(term)}
                                      className="px-4 py-2.5 bg-zinc-800 text-white rounded-xl text-xs font-bold hover:bg-zinc-900 transition-all border border-zinc-700 flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                                    >
                                      <Sparkles className="w-3.5 h-3.5 text-[#f57c00]" />
                                      {term}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <>
                                {suggestions.intents.length > 0 && (
                                  <div className="mb-6">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-1.5 h-4 bg-[#f57c00] rounded-full" />
                                      <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">Intenções Detectadas</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {suggestions.intents.map(intent => (
                                        <button 
                                          key={intent.id}
                                          onClick={() => handleSelectSuggestion(intent.name)}
                                          className="px-4 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-all border border-orange-500 shadow-sm active:scale-95 cursor-pointer"
                                        >
                                          {intent.name}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {suggestions.types.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-1.5 h-4 bg-[#00897b] rounded-full" />
                                      <span className="text-xs font-black text-zinc-800 uppercase tracking-wider">Sugestões de Filtro</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {suggestions.types.map(type => (
                                        <button 
                                          key={type}
                                          onClick={() => handleSelectSuggestion(type)}
                                          className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all border border-emerald-500 flex items-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                                        >
                                          <Search className="w-3.5 h-3.5" />
                                          {type}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {suggestions.intents.length === 0 && suggestions.types.length === 0 && (
                                  <div className="py-4 text-center">
                                    <p className="text-xs text-zinc-500 italic">Continue digitando para ver sugestões...</p>
                                  </div>
                                )}
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Interactive search examples / suggestions chips directly under the search bar */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-xl mx-auto px-1">
                      <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-extrabold block w-full text-center mb-1">Exemplos de busca:</span>
                      {[
                        "Quero comer",
                        "Meu pneu furou",
                        "Preciso de um eletricista",
                        "Farmácia aberta",
                        "Hospital",
                        "Táxi"
                      ].map((ex) => (
                        <button
                          key={ex}
                          onClick={() => {
                            setInput(ex);
                            performSearch(ex, true);
                          }}
                          className="px-2.5 py-1 bg-white/70 hover:bg-white active:scale-95 text-zinc-800 border border-zinc-200/80 rounded-full text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shadow-xs"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>

                    {/* Categories Section: Modern Grid of 4 categories per line on small screen */}
                    <div className="mt-8 pb-4 w-full">
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-x-2 gap-y-5 max-w-4xl mx-auto w-full px-1">
                        {CATEGORIES.map((cat, index) => {
                          const displayName = cat.name === "Mobilidade Urbana" ? "Mobilidade" : cat.name;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => handleCategoryClick(cat.id)}
                              className={`group flex flex-col items-center justify-start focus:outline-none cursor-pointer ${
                                index >= 3 ? 'hidden sm:flex' : 'flex'
                              }`}
                            >
                              <div 
                                className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-lg active:scale-95 shadow-md mb-2 shrink-0 border border-zinc-100"
                              >
                                <IconRenderer name={cat.icon} color={cat.color} className="w-6 h-6" />
                              </div>
                              <span className="text-[10px] sm:text-xs font-bold text-zinc-800 text-center leading-tight tracking-tight group-hover:text-zinc-950 transition-colors line-clamp-2 max-w-[85px] drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]">
                                {displayName}
                              </span>
                            </button>
                          );
                        })}

                        {/* Ver Todas card */}
                        <button
                          onClick={() => setIsAllCategoriesModalOpen(true)}
                          className="group flex flex-col items-center justify-start focus:outline-none cursor-pointer"
                        >
                          <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white/80 hover:bg-white border border-zinc-200/80 flex items-center justify-center transition-all group-hover:scale-110 active:scale-95 shadow-md mb-2 shrink-0">
                            <MoreHorizontal className="w-6 h-6 text-zinc-800" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-bold text-zinc-700 text-center leading-tight tracking-tight group-hover:text-zinc-950 transition-colors drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]">
                            Ver Todas
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Mover o botão "Sugira um Local" para abaixo das categorias */}
                    <div className="w-full max-w-xl mx-auto mt-6 px-1">
                      <button
                        onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
                        className="w-full bg-white hover:bg-zinc-50 border border-zinc-200/80 hover:shadow-lg rounded-3xl p-4 flex items-center gap-4 transition-all duration-300 group text-left cursor-pointer active:scale-[0.99] shadow-md"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all shrink-0">
                          <Plus className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm sm:text-base text-zinc-900 group-hover:text-[#00897b] transition-colors leading-tight">
                            Sugira um Local
                          </h4>
                          <p className="text-xs text-zinc-500 mt-0.5 font-medium leading-none">
                            Ajude a fortalecer a comunidade local.
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-600 group-hover:bg-zinc-100 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    </div>

                    {/* Translucent Bible Quotes box at the very bottom of the gradient container */}
                    <div className="w-full max-w-xl mx-auto mt-6 px-1">
                      <div className="bg-white/80 backdrop-blur-md border border-zinc-200/80 rounded-3xl p-5 text-left relative overflow-hidden shadow-md">
                        <div className="flex gap-4 items-start">
                          <span className="text-4xl text-zinc-300 font-serif leading-none shrink-0 select-none">“</span>
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-zinc-800 italic font-bold leading-relaxed">
                              Disse-lhe Jesus: Eu sou o caminho, e a verdade e a vida; ninguém vem ao Pai, senão por mim.
                            </p>
                            <p className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase text-right mt-1 select-none">
                              — João 14:6
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Featured Section */}
                <FeaturedEstablishments userLocation={location} />

                {/* Nearby Section (GPS based) */}
                <NearbyEstablishments userLocation={location} />
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
                            className="px-5 py-2.5 bg-white border-2 border-zinc-200 rounded-2xl text-xs font-black text-zinc-800 hover:border-[#00897b] hover:text-[#00897b] hover:bg-emerald-50 transition-all shadow-sm active:scale-95"
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
                    <motion.div 
                      key={`${activeCategoryId}-${selectedSubCategory}-${categoryEstablishments.length}`}
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-4 pb-20"
                    >
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
                              uri: est.maps_link || '',
                              location: {
                                latitude: est.latitude,
                                longitude: est.longitude
                              },
                              phone: est.phone,
                              whatsapp: est.whatsapp,
                              website: est.website,
                              rating: est.rating,
                              address: est.address,
                              hours: est.hours,
                              categoryId: est.category_id,
                              subCategory: est.sub_category,
                              cityId: est.city_id,
                              is_featured: est.is_featured,
                              is_verified: est.is_verified,
                              is_premium: est.is_premium,
                              images: est.images || (typeof est.image === 'string' ? [est.image] : []),
                              tags: est.tags,
                              plusCode: est.plus_code || est.plusCode,
                              instagram_url: est.instagram_url || est.instagramUrl,
                              instagramUrl: est.instagram_url || est.instagramUrl,
                              facebook_url: est.facebook_url || est.facebookUrl,
                              facebookUrl: est.facebook_url || est.facebookUrl,
                              whatsapp_url: est.whatsapp_url || est.whatsappUrl,
                              whatsappUrl: est.whatsapp_url || est.whatsappUrl,
                              youtube_url: est.youtube_url || est.youtubeUrl,
                              youtubeUrl: est.youtube_url || est.youtubeUrl,
                              tiktok_url: est.tiktok_url || est.tiktokUrl,
                              tiktokUrl: est.tiktok_url || est.tiktokUrl,
                              linkedin_url: est.linkedin_url || est.linkedinUrl,
                              linkedinUrl: est.linkedin_url || est.linkedinUrl,
                              twitter_url: est.twitter_url || est.twitterUrl,
                              twitterUrl: est.twitter_url || est.twitterUrl,
                              telegram_url: est.telegram_url || est.telegramUrl,
                              telegramUrl: est.telegram_url || est.telegramUrl,
                              google_maps_url: est.google_maps_url || est.googleMapsUrl,
                              googleMapsUrl: est.google_maps_url || est.googleMapsUrl
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
                            distStr = dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(1).replace('.', ',')} km`;
                          }

                          return (
                            <motion.div key={est.id} variants={itemVariants}>
                              <EstablishmentCard 
                                chunk={chunk}
                                distance={distStr}
                                userLocation={location}
                                isRealLocation={isRealLocation}
                                onRefresh={refreshData}
                              />
                            </motion.div>
                          );
                        })
                      ) : (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-200">
                          <p className="text-sm text-zinc-400">Nenhum estabelecimento encontrado nesta categoria.</p>
                        </div>
                      )}
                    </motion.div>
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
                    <button
                      onClick={runGeoBackfillAndLoad}
                      disabled={isBackfilling}
                      className="ml-2 p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-[#00897b] transition-all flex items-center gap-1 text-[10px] font-bold bg-white shrink-0"
                      title="Sincronizar e carregar novas cidades/locais cadastrados"
                    >
                      {isBackfilling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
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
                        <Loader2 className="w-4 h-4 animate-spin text-[#00897b]" />
                        <span className="text-sm text-zinc-500 font-medium">
                          {allGroundingChunks.length > 0 
                            ? "Enriquecendo resultados com IA..." 
                            : "Analisando dados locais..."}
                        </span>
                      </div>
                    </motion.div>
                  )}
                  {messages.length > 1 && allGroundingChunks.length === 0 && !isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-center py-4"
                    >
                      <button 
                        onClick={findNearbyEstablishments}
                        className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95"
                      >
                        <MapPin className="w-4 h-4" />
                        Ver locais próximos a mim
                      </button>
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
                      className="w-full pl-5 pr-24 py-4 bg-zinc-100 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleListening(true)}
                      className={`absolute right-14 top-2 bottom-2 px-3 rounded-xl transition-all relative flex items-center justify-center ${
                        isListening 
                          ? 'bg-red-50 text-red-600 animate-pulse border border-red-200' 
                          : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600'
                      }`}
                      title={isListening ? "Desativar busca por voz" : "Buscar por voz (fale agora)"}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                      {isListening && (
                        <span className="absolute -inset-0.5 rounded-xl bg-red-400/20 animate-ping pointer-events-none" />
                      )}
                    </button>
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
        <div className="w-full lg:w-[400px] h-full">
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
      {/* Unified Floating Action Button for Suggesting Local */}
      {activeCategoryId !== null ? (
        // Category/Sub-category view FAB: bottom-6 for both. On mobile, we show a gorgeous pill, on desktop a circle
        <button
          onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
          className={`fixed right-6 z-40 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-bold border border-emerald-500 shadow-emerald-700/20
            ${isMobile 
              ? 'bottom-6 px-4 h-12 rounded-full gap-1.5' 
              : 'bottom-6 w-14 h-14 rounded-full'
            }`}
          title="Sugira um Local"
        >
          <Plus className={isMobile ? "w-4 h-4" : "w-6 h-6"} />
          {isMobile && <span>Sugira um Local</span>}
        </button>
      ) : (
        // Home/Chat view FAB: visible ONLY on mobile at bottom-24 (docked gracefully above the chat text field)
        <button 
          onClick={() => user ? setIsRegisterModalOpen(true) : setIsAuthModalOpen(true)}
          className="md:hidden fixed bottom-24 right-6 z-40 flex items-center gap-1.5 px-4 h-12 bg-emerald-600 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all font-bold text-xs border border-emerald-500 shadow-emerald-700/20 animate-bounce"
          style={{ animationDuration: '3s' }}
          title="Sugira um Local"
        >
          <Plus className="w-4 h-4" />
          <span>Sugira um Local</span>
        </button>
      )}

      {/* Modals */}
      <RegisterEstablishmentModal 
        isOpen={isRegisterModalOpen} 
        onClose={() => setIsRegisterModalOpen(false)} 
      />
      <UserEstablishmentsModal 
        isOpen={isUserEstModalOpen} 
        onClose={() => setIsUserEstModalOpen(false)} 
      />
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
      />
      <AdminClaimsModal
        isOpen={isAdminClaimsModalOpen}
        onClose={() => setIsAdminClaimsModalOpen(false)}
      />
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      <RegisterUserModal
        isOpen={isRegisterUserModalOpen}
        onClose={() => setIsRegisterUserModalOpen(false)}
        onSwitchToLogin={() => {
          setIsRegisterUserModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />
      <AllCategoriesModal
        isOpen={isAllCategoriesModalOpen}
        onClose={() => setIsAllCategoriesModalOpen(false)}
        onSelectCategory={handleCategoryClick}
      />
      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
      />
    </div>
  );
}
