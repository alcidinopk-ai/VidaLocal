import React, { useState } from 'react';
import { suggestBusinessHours } from '../services/geminiService';
import { OpenLocationCode } from 'open-location-code';
import { 
  X, 
  Store, 
  MapPin, 
  Phone, 
  MessageCircle,
  Link as LinkIcon,
  Globe, 
  Clock, 
  CheckCircle2, 
  Loader2,
  Image as ImageIcon,
  Plus,
  ShieldCheck,
  Sparkles,
  Crown,
  Wand2,
  Compass,
  Hash,
  Copy,
  Upload,
  Camera,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCity } from '../contexts/CityContext';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, SUB_CATEGORIES } from '../constants/taxonomy';
import { extractCoordinatesFromMapsLink } from '../utils/maps';
import { compressAndUploadImage } from '../utils/imageCompression';

// Helper to clean and parse coordinate input supporting empty, number, comma, and dot representations.
// Automatically heals coordinates that are missing decimal separators (e.g. -490669319 -> -49.0669319) based on typical values and optional reference coordinate
const cleanAndParseCoordinate = (val: any, referenceValue?: number): number | null => {
  if (val === null || val === undefined) return null;
  
  // Convert any input format to clean string
  let str = String(val).replace(',', '.').trim();
  if (!str) return null;

  let num = parseFloat(str);
  if (isNaN(num)) return null;

  // Let's check if the absolute value is too large, indicating a missing dot/separator
  if (Math.abs(num) > 180) {
    const isNegative = str.startsWith('-');
    const digitsOnly = str.replace(/[^0-9]/g, '');
    if (digitsOnly.length > 2) {
      // Determine how many digits should be in the integer part.
      let intDigits = 2; // Default to 2 digits (e.g., -49, -11)
      if (referenceValue !== undefined && referenceValue !== null) {
        const absRef = Math.max(1, Math.floor(Math.abs(referenceValue)));
        intDigits = String(absRef).length;
      }

      const intPart = digitsOnly.substring(0, intDigits);
      const decPart = digitsOnly.substring(intDigits);
      const reconstructed = parseFloat(`${isNegative ? '-' : ''}${intPart}.${decPart}`);
      if (!isNaN(reconstructed)) {
        return reconstructed;
      }
    }
  }

  return num;
};

interface RegisterEstablishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSuccess?: () => void;
}

export const RegisterEstablishmentModal: React.FC<RegisterEstablishmentModalProps> = ({ 
  isOpen, 
  onClose, 
  initialData,
  onSuccess 
}) => {
  const { currentCity, setCity } = useCity();
  const { user, profile, role } = useAuth();
  const isAdmin = user && (role === 'admin' || user.email === 'alcidinopk@gmail.com');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    subCategory: [] as string[],
    address: '',
    phone: '',
    whatsapp: '',
    website: '',
    hours: '',
    is_open_24_hours: false,
    description: '',
    latitude: null as number | string | null,
    longitude: null as number | string | null,
    mapsLink: '',
    plusCode: '',
    is_featured: false,
    is_verified: false,
    is_premium: false,
    images: [] as string[],
    tags: ''
  });

  const [openingHours, setOpeningHours] = useState([
    { day: 0, label: 'Domingo', slots: [{ open: '08:00', close: '12:00' }], closed: true },
    { day: 1, label: 'Segunda-feira', slots: [{ open: '08:00', close: '18:00' }], closed: false },
    { day: 2, label: 'Terça-feira', slots: [{ open: '08:00', close: '18:00' }], closed: false },
    { day: 3, label: 'Quarta-feira', slots: [{ open: '08:00', close: '18:00' }], closed: false },
    { day: 4, label: 'Quinta-feira', slots: [{ open: '08:00', close: '18:00' }], closed: false },
    { day: 5, label: 'Sexta-feira', slots: [{ open: '08:00', close: '18:00' }], closed: false },
    { day: 6, label: 'Sábado', slots: [{ open: '08:00', close: '12:00' }], closed: false },
  ]);

  React.useEffect(() => {
    setImageErrors({});
    if (initialData && isOpen) {
      // Process subCategory into array if it's a string
      let subCats: string[] = [];
      if (initialData.subCategory) {
        if (Array.isArray(initialData.subCategory)) {
          subCats = initialData.subCategory;
        } else if (typeof initialData.subCategory === 'string') {
          // Handle both ' | ' and ', ' separators
          if (initialData.subCategory.includes(' | ')) {
            subCats = initialData.subCategory.split(' | ').map(s => s.trim()).filter(Boolean);
          } else {
            // Regex to split by comma but NOT inside parentheses
            subCats = initialData.subCategory.split(/,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean);
          }
        }
      } else if (initialData.sub_category) {
        if (initialData.sub_category.includes(' | ')) {
          subCats = initialData.sub_category.split(' | ').map((s: string) => s.trim()).filter(Boolean);
        } else {
          subCats = initialData.sub_category.split(/,\s*(?![^()]*\))/).map((s: string) => s.trim()).filter(Boolean);
        }
      }

      let lat: any = null;
      if (initialData.latitude !== undefined && initialData.latitude !== null) {
        lat = String(initialData.latitude);
      } else if (initialData.location?.latitude !== undefined && initialData.location?.latitude !== null) {
        lat = String(initialData.location.latitude);
      }

      let lng: any = null;
      if (initialData.longitude !== undefined && initialData.longitude !== null) {
        lng = String(initialData.longitude);
      } else if (initialData.location?.longitude !== undefined && initialData.location?.longitude !== null) {
        lng = String(initialData.location.longitude);
      }

      // Automatically clean and parse numeric coordinates to safely recover missing decimal layout
      const cleanedLat = cleanAndParseCoordinate(lat, currentCity?.latitude);
      const cleanedLng = cleanAndParseCoordinate(lng, currentCity?.longitude);

      setFormData({
        name: initialData.name || initialData.title || '',
        categoryId: String(initialData.category_id || initialData.categoryId || ''),
        subCategory: subCats,
        address: initialData.address || '',
        phone: initialData.phone || '',
        whatsapp: initialData.whatsapp || '',
        website: initialData.website || '',
        hours: initialData.hours || '',
        is_open_24_hours: initialData.is_open_24_hours || false,
        description: initialData.description || '',
        latitude: cleanedLat !== null ? String(cleanedLat) : '',
        longitude: cleanedLng !== null ? String(cleanedLng) : '',
        mapsLink: initialData.maps_link || initialData.uri || initialData.mapsLink || '',
        plusCode: initialData.plus_code || initialData.plusCode || '',
        is_featured: initialData.is_featured || false,
        is_verified: initialData.is_verified || false,
        is_premium: initialData.is_premium || false,
        images: initialData.images || [],
        tags: initialData.tags || ''
      });
      // Set opening hours if available in initialData
      if (initialData.opening_hours && Array.isArray(initialData.opening_hours)) {
        const newHours = [0, 1, 2, 3, 4, 5, 6].map(dayNum => {
          const dayLabel = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][dayNum];
          const daySlots = initialData.opening_hours.filter((oh: any) => oh.day_of_week === dayNum);
          
          if (daySlots.length > 0) {
            const isClosed = daySlots.every((s: any) => s.is_closed);
            return {
              day: dayNum,
              label: dayLabel,
              closed: isClosed,
              slots: isClosed ? [{ open: '', close: '' }] : daySlots.map((s: any) => ({
                open: s.open_time?.substring(0, 5) || '',
                close: s.close_time?.substring(0, 5) || ''
              }))
            };
          }
          return { day: dayNum, label: dayLabel, slots: [{ open: '', close: '' }], closed: true };
        });
        setOpeningHours(newHours);
      }
    } else if (!initialData && isOpen) {
      setFormData({
        name: '',
        categoryId: '',
        subCategory: [],
        address: '',
        phone: '',
        whatsapp: '',
        website: '',
        hours: '',
        is_open_24_hours: false,
        description: '',
        latitude: null,
        longitude: null,
        mapsLink: '',
        plusCode: '',
        is_featured: false,
        is_verified: false,
        is_premium: false,
        images: [],
        tags: ''
      });
    }
  }, [initialData, isOpen]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSuggestingHours, setIsSuggestingHours] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [isHoursExpanded, setIsHoursExpanded] = useState(false);

  const handleSuggestHours = async () => {
    if (!formData.name) {
      setError("Por favor, informe o nome do estabelecimento primeiro.");
      return;
    }
    
    setIsSuggestingHours(true);
    setError(null);
    
    try {
      const result = await suggestBusinessHours(
        formData.name, 
        currentCity.name, 
        formData.address
      );
      
      if (result) {
        setFormData(prev => ({ 
          ...prev, 
          hours: result.summary,
          is_open_24_hours: result.is24h
        }));

        if (result.structured && Array.isArray(result.structured)) {
          const newHours = openingHours.map(h => {
            const found = result.structured?.find((s: any) => s.day === h.day);
            if (found) {
              return {
                ...h,
                slots: found.slots && found.slots.length > 0 
                  ? found.slots 
                  : [{ open: '', close: '' }],
                closed: found.closed
              };
            }
            return h;
          });
          setOpeningHours(newHours);
          setIsHoursExpanded(true);
        }
      } else {
        setError("Não consegui encontrar os horários automaticamente. Por favor, preencha manualmente.");
      }
    } catch (err: any) {
      console.error("Error suggesting hours:", err);
      if (err.message === "QUOTA_EXCEEDED") {
        setError("Atingimos o limite de buscas da IA por agora. Por favor, preencha os horários manualmente ou tente novamente em alguns minutos.");
      } else {
        setError("Erro ao buscar horários. Tente preencher manualmente.");
      }
    } finally {
      setIsSuggestingHours(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        }));
        setIsLocating(false);
        alert("Localização obtida com sucesso!");
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
        alert("Não foi possível obter sua localização.");
      }
    );
  };

  const handleAddImage = () => {
    fileInputRef.current?.click();
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Check total images limit of 5 (already in state + new ones)
    const currentImagesCount = formData.images.length;
    if (currentImagesCount + fileList.length > 5) {
      alert(`Você pode adicionar no máximo 5 fotos. Você já possui ${currentImagesCount} e tentou adicionar ${fileList.length}.`);
      e.target.value = '';
      return;
    }

    setIsUploadingImage(true);
    setError(null);
    console.log(`[Upload UI] Selecionado(s) ${fileList.length} arquivo(s) para otimização e upload.`);

    try {
      // Process files in parallel to optimize and upload
      const uploadPromises = fileList.map(async (file) => {
        try {
          const publicUrlOrBase64 = await compressAndUploadImage(file, 'establishments');
          return publicUrlOrBase64;
        } catch (uploadErr: any) {
          console.error(`[Upload UI - Erro Individual] Erro ao enviar ${file.name}:`, uploadErr);
          return null;
        }
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const validUrls = uploadedUrls.filter((url): url is string => url !== null);

      if (validUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...validUrls]
        }));
        console.log(`[Upload UI] ${validUrls.length} imagem(ns) adicionada(s) com sucesso.`);
      } else {
        setError("Ocorreu um erro ao otimizar e enviar suas fotos. Por favor, tente novamente.");
      }
    } catch (err: any) {
      console.error("[Upload UI - Exceção Geral] Erro ao processar seleção de arquivos:", err);
      setError("Erro no processamento das imagens: " + (err.message || String(err)));
    } finally {
      setIsUploadingImage(false);
      // Reset input value so same file can be selected again if desired
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleAddUrlImage = () => {
    const trimmedUrl = imageUrlInput.trim();
    if (!trimmedUrl) return;

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      alert("Por favor, insira um link de imagem começando com http:// ou https://");
      return;
    }

    if (formData.images.length >= 5) {
      alert(`Você pode adicionar no máximo 5 fotos.`);
      return;
    }

    setFormData(prev => ({
      ...prev,
      images: [...prev.images, trimmedUrl]
    }));
    setImageUrlInput(""); // clear the input after adding!
  };

  const resolveAndSetPlusCode = (inputCode: string, showAlert = false) => {
    const trimmed = inputCode.trim();
    if (!trimmed) return false;

    // Cidades conhecidas e suas coordenadas para recuperação de Plus Code curto caso o usuário digite o endereço de outra cidade
    const KNOWN_CITIES_COORDS = [
      { name: 'paraiso', lat: -10.1753, lng: -48.8833 },
      { name: 'guarai', lat: -8.8344, lng: -48.5103 },
      { name: 'gurupi', lat: -11.7298, lng: -49.0678 },
      { name: 'palmas', lat: -10.1844, lng: -48.3336 },
      { name: 'araguaina', lat: -7.1925, lng: -48.2078 },
      { name: 'porto nacional', lat: -10.7081, lng: -48.4172 },
      { name: 'colinas', lat: -8.0558, lng: -48.4764 },
      { name: 'araguatins', lat: -5.6503, lng: -48.1250 },
      { name: 'tocantinopolis', lat: -6.3233, lng: -47.4128 },
      { name: 'dianopolis', lat: -11.6286, lng: -46.8203 },
      { name: 'alianca', lat: -11.3060, lng: -48.9329 },
    ];

    try {
      const olc = new OpenLocationCode();
      if (olc.isValid(trimmed)) {
        let fullCode = trimmed;
        if (olc.isShort(trimmed)) {
          let refLat = cleanAndParseCoordinate(formData.latitude, currentCity?.latitude) || currentCity?.latitude || -11.7298;
          let refLng = cleanAndParseCoordinate(formData.longitude, currentCity?.longitude) || currentCity?.longitude || -49.0678;

          // Se houver endereço preenchido, tenta detectar uma cidade de referência
          if (formData.address) {
            const normalizedAddress = formData.address
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");

            for (const city of KNOWN_CITIES_COORDS) {
              if (normalizedAddress.includes(city.name)) {
                refLat = city.lat;
                refLng = city.lng;
                console.log(`[PlusCode] Detectada cidade de referência '${city.name}' no endereço. Coordenadas: ${refLat}, ${refLng}`);
                break;
              }
            }
          }

          fullCode = olc.recoverNearest(trimmed, refLat, refLng);
        }

        if (olc.isFull(fullCode)) {
          const decoded = olc.decode(fullCode);
          setFormData(prev => ({
            ...prev,
            latitude: decoded.latitudeCenter,
            longitude: decoded.longitudeCenter
          }));
          if (showAlert) {
            alert(`Plus Code resolvido com sucesso!\nCoordenadas: ${decoded.latitudeCenter}, ${decoded.longitudeCenter}`);
          }
          return true;
        }
      }
    } catch (err) {
      if (showAlert) {
        console.error("Plus Code error:", err);
        alert("Erro ao decodificar o Plus Code. Verifique o formato.");
      }
    }
    return false;
  };

  const handleResolvePlusCode = () => {
    if (!formData.plusCode.trim()) {
      alert("Por favor, insira um Plus Code.");
      return;
    }
    const resolved = resolveAndSetPlusCode(formData.plusCode, true);
    if (!resolved) {
      alert("Plus Code inválido ou incompleto. Certifique-se de que é um código válido.");
    }
  };

  const filteredSubCategories = SUB_CATEGORIES.filter(
    sc => sc.categoryId === Number(formData.categoryId)
  );

  const handleHourChange = (day: number, field: 'open' | 'close' | 'closed', value: any, slotIndex: number = 0) => {
    const newHours = openingHours.map(h => {
      if (h.day === day) {
        if (field === 'closed') return { ...h, closed: value };
        
        const newSlots = [...h.slots];
        newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
        return { ...h, slots: newSlots };
      }
      return h;
    });
    setOpeningHours(newHours);
  };

  const addSlot = (day: number) => {
    setOpeningHours(prev => prev.map(h => {
      if (h.day === day) {
        return { ...h, slots: [...h.slots, { open: '14:00', close: '18:00' }] };
      }
      return h;
    }));
  };

  const removeSlot = (day: number, slotIndex: number) => {
    setOpeningHours(prev => prev.map(h => {
      if (h.day === day) {
        const newSlots = h.slots.filter((_, i) => i !== slotIndex);
        return { ...h, slots: newSlots.length > 0 ? newSlots : [{ open: '', close: '' }] };
      }
      return h;
    }));
  };

  const copyToAll = (sourceDay: number) => {
    const source = openingHours.find(h => h.day === sourceDay);
    if (!source) return;
    
    setOpeningHours(prev => prev.map(h => {
      if (h.day === sourceDay) return h;
      return {
        ...h,
        closed: source.closed,
        slots: source.slots.map(s => ({ ...s }))
      };
    }));
  };

  const formatHoursSummary = () => {
    if (formData.is_open_24_hours) return 'Aberto 24 horas';
    
    return openingHours
      .map(h => {
        const slotsStr = h.closed 
          ? 'Fechado' 
          : h.slots.map(s => `${s.open}-${s.close}`).join(', ');
        return `${h.label}: ${slotsStr}`;
      })
      .join('\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Register] Submit triggered");
    
    if (!user) {
      console.error("[Register] No user found in context");
      setError("Você precisa estar logado para cadastrar um local.");
      return;
    }

    if (formData.subCategory.length === 0) {
      setError("Por favor, selecione pelo menos um tipo de estabelecimento.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    if (!user) {
      setError("Você precisa estar logado para salvar alterações.");
      setIsLoading(false);
      return;
    }

    const parsedLat = cleanAndParseCoordinate(formData.latitude, currentCity?.latitude);
    const parsedLng = cleanAndParseCoordinate(formData.longitude, currentCity?.longitude);

    if (showManualCoords && (formData.latitude || formData.longitude)) {
      if (parsedLat === null || parsedLng === null) {
        setError("Por favor, insira coordenadas geográficas válidas (ex: -11.7289 ou -11,7289). Use ponto ou vírgula decimal.");
        setIsLoading(false);
        return;
      }
    }
    
    try {
      const payload = {
        ...formData,
        latitude: parsedLat,
        longitude: parsedLng,
        subCategory: formData.subCategory.join(' | '),
        hours: formatHoursSummary(),
        openingHours: openingHours.flatMap(h => 
          h.closed 
            ? [{ day_of_week: h.day, open_time: null, close_time: null, is_closed: true }]
            : h.slots.map(s => ({
                day_of_week: h.day,
                open_time: s.open,
                close_time: s.close,
                is_closed: false
              }))
        ),
        cityId: initialData?.cityId || currentCity.id,
        cityName: initialData?.cityName || currentCity.name,
        cityUf: initialData?.cityUf || currentCity.uf,
        cityLat: initialData?.cityLat || currentCity.latitude,
        cityLng: initialData?.cityLng || currentCity.longitude,
        userId: user.id,
        userEmail: user.email
      };
      
      console.log("[Register] Sending payload. Images:", payload.images?.length || 0, "Approximate size:", JSON.stringify(payload).length, "bytes");

      const isUpdate = initialData && initialData.id;
      const url = isUpdate 
        ? `/api/establishments/${initialData.id}` 
        : '/api/establishments/register';
      
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-email': user.email || ''
        },
        body: JSON.stringify(payload)
      });

      console.log("[Register] Response status:", response.status);
      
      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error("[Register] Error payload:", text);
        
        if (response.status === 403) {
          let serverError = "";
          try {
            const errorData = JSON.parse(text);
            serverError = errorData.error || errorData.message || "";
          } catch (e) {}
          throw new Error(`ERRO 403 (Proibido): ${serverError || 'O servidor bloqueou o envio.'} Se este erro acontece mesmo SEM FOTOS, pode haver uma restrição no firewall ou banco de dados.`);
        }
        
        throw new Error(`Servidor retornou resposta inesperada (${response.status})`);
      }

      console.log("[Register] Result:", result);

      if (response.ok) {
        setIsSubmitted(true);
        
        // Dispatch global update event so any listing components or layouts can update immediately
        const updatedEst = result && (result.id ? result : result.data);
        if (updatedEst && updatedEst.id) {
          window.dispatchEvent(new CustomEvent('vida360:establishment-updated', { detail: updatedEst }));
        }

        // Automatic shift of city if a new city was resolved/created by coordinates
        if (result.resolvedCity && result.resolvedCity.id !== currentCity.id) {
          setCity(result.resolvedCity);
          alert(`Excelente! Identificamos que este local fica em ${result.resolvedCity.name} - ${result.resolvedCity.uf}. Atualizamos a cidade ativa do aplicativo para você encontrar o local!`);
        }

        if (onSuccess) onSuccess();
        // Inform user about where it was saved
        if (result.supabase === false) {
          console.warn("[Register] Saved locally only (Supabase not configured)");
        }
        
        setTimeout(() => {
          setIsSubmitted(false);
          onClose();
          setFormData({
            name: '',
            categoryId: '',
            subCategory: [],
            address: '',
            phone: '',
            whatsapp: '',
            website: '',
            hours: '',
            is_open_24_hours: false,
            description: '',
            latitude: null,
            longitude: null,
            mapsLink: '',
            is_featured: false,
            is_verified: false,
            is_premium: false,
            plusCode: '',
            images: [],
            tags: ''
          });
        }, 3000);
      } else {
        setError(result.error || result.message || "Ocorreu um erro ao cadastrar.");
      }
    } catch (error: any) {
      console.error("[Register] Connection error:", error);
      setError(`Erro de conexão com o servidor: ${error.message}. Por favor, tente novamente.`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#00897b] flex items-center justify-center text-white shadow-lg shadow-[#00897b]/20">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-tight">
                {initialData ? 'Atualizar informações do local' : 'Cadastrar novo local'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {isSubmitted ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">
                {initialData ? 'Alterações Salvas!' : 'Estabelecimento Publicado!'}
              </h3>
              <p className="text-zinc-500 mt-3 max-w-md mx-auto">
                {initialData 
                  ? 'As informações foram atualizadas com sucesso.' 
                  : `Obrigado por contribuir! Seu cadastro foi realizado com sucesso e **já está visível** para todos os usuários do VidaLocal em ${currentCity.name}.`}
              </p>
              <button 
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
              >
                Ver no Mapa
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              {error && (
                <div className="p-6 bg-red-50/50 border border-red-100 rounded-3xl flex items-center gap-6 text-red-600 mb-8">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                    <X className="w-6 h-6 text-white stroke-[3px]" />
                  </div>
                  <p className="font-bold text-lg leading-tight">{error}</p>
                </div>
              )}
              
              <div className="space-y-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Informações Básicas</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Nome do Estabelecimento *</label>
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: SOS Borracharia"
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Categoria *</label>
                        <select 
                          required
                          value={formData.categoryId}
                          onChange={e => setFormData({...formData, categoryId: e.target.value, subCategory: []})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base appearance-none"
                        >
                          <option value="">Selecione...</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Tipos (Selecione um ou mais) *</label>
                        <div className="relative">
                          <div className="flex flex-wrap gap-2 p-2 bg-zinc-50 border border-zinc-100 rounded-2xl min-h-[58px]">
                            {filteredSubCategories.length === 0 && (
                              <span className="text-zinc-400 text-sm p-2 italic">Selecione uma categoria primeiro</span>
                            )}
                            {filteredSubCategories.map(sc => {
                              const isSelected = formData.subCategory.includes(sc.name);
                              return (
                                <button
                                  key={sc.id}
                                  type="button"
                                  onClick={() => {
                                    const current = [...formData.subCategory];
                                    if (isSelected) {
                                      setFormData({
                                        ...formData,
                                        subCategory: current.filter(name => name !== sc.name)
                                      });
                                    } else {
                                      setFormData({
                                        ...formData,
                                        subCategory: [...current, sc.name]
                                      });
                                    }
                                  }}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                    isSelected 
                                      ? "bg-[#00897b] text-white border-[#00897b] shadow-lg shadow-[#00897b]/10" 
                                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                                  }`}
                                >
                                  {sc.name}
                                </button>
                              );
                            })}
                          </div>
                          {formData.subCategory.length === 0 && formData.categoryId && (
                            <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">Selecione pelo menos um tipo</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photos Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Fotos do Local</h4>
                    <div className="flex items-center gap-4">
                      <button 
                        type="button" 
                        onClick={handleCameraClick}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#00897b] hover:text-[#00796b] transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Usar Câmera
                      </button>
                      <button 
                        type="button" 
                        onClick={handleAddImage}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#00897b] hover:text-[#00796b] transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Anexar Fotos
                      </button>
                    </div>
                  </div>
                  
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    multiple
                    className="hidden"
                  />
                  
                  <input 
                    type="file"
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {formData.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden group bg-zinc-100 border border-zinc-200">
                        {!imageErrors[img] ? (
                          <img 
                            src={img} 
                            alt={`Foto ${idx + 1}`} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [img]: true }));
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-2.5 text-center bg-zinc-50 text-zinc-400">
                            <AlertCircle className="w-5 h-5 mb-1 text-red-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 block">Link de Foto não Carrega</span>
                            <span className="text-[8px] text-zinc-400 block leading-tight mt-1 px-1">
                              Insira o link direto (<span className="text-zinc-500 font-medium">.jpg, .png...</span>) ou tente outra imagem.
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleRemoveImage(idx);
                            setImageErrors(prev => {
                              const updated = { ...prev };
                              delete updated[img];
                              return updated;
                            });
                          }}
                          className={`absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full transition-opacity shadow-lg group-hover:opacity-100 ${imageErrors[img] ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    
                    {isUploadingImage && (
                      <div className="aspect-video rounded-2xl border border-[#00897b]/30 bg-[#00897b]/5 flex flex-col items-center justify-center gap-2 text-[#00897b] animate-pulse">
                        <Loader2 className="w-6 h-6 animate-spin text-[#00897b]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#00897b] text-center px-2">Otimizando e Enviando...</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCameraClick}
                      disabled={isUploadingImage}
                      className="aspect-video rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-[#00897b] hover:border-[#00897b] hover:bg-emerald-50/50 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Usar Câmera</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddImage}
                      disabled={isUploadingImage}
                      className="aspect-video rounded-2xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:text-[#00897b] hover:border-[#00897b] hover:bg-emerald-50/50 transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Anexar Fotos</span>
                    </button>
                  </div>

                  {/* URL image attachment box */}
                  {isAdmin && (
                    <div className="mt-4 p-4 border border-zinc-100 rounded-2xl bg-zinc-50/50 space-y-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500">Ou adicione Fotos via Link/URL</label>
                      <div className="flex gap-2">
                        <input 
                          type="url"
                          value={imageUrlInput}
                          onChange={e => setImageUrlInput(e.target.value)}
                          placeholder="https://exemplo.com/foto-do-estabelecimento.jpg"
                          className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleAddUrlImage}
                          className="px-5 py-3 bg-[#00897b] text-white font-bold text-sm rounded-xl hover:bg-[#00796b] transition-all flex items-center gap-1 active:scale-[0.98]"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        💡 <strong>Dica de ouro:</strong> O link deve ser de uma imagem direta (geralmente terminando com <code>.jpg</code>, <code>.jpeg</code>, <code>.png</code> ou <code>.webp</code>). 
                        Se você encontrou a foto na internet, clique com o botão direito sobre ela e escolha <strong>"Copiar endereço da imagem"</strong> antes de colar aqui!
                      </p>
                    </div>
                  )}
                </div>

                {/* Contact & Location */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Contato e Localização</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Endereço Completo</label>
                      <input 
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="Av. Maranhão, 2404"
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Telefone</label>
                        <input 
                          type="tel"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="(00) 00000-0000"
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">WhatsApp</label>
                        <input 
                          type="tel"
                          value={formData.whatsapp}
                          onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                          placeholder="(00) 00000-0000"
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Website</label>
                      <input 
                        type="url"
                        value={formData.website}
                        onChange={e => setFormData({...formData, website: e.target.value})}
                        placeholder="https://..."
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Tags de Busca</label>
                      <input 
                        type="text"
                        value={formData.tags}
                        onChange={e => setFormData({...formData, tags: e.target.value})}
                        placeholder="Ex: #Evento2026, #RoteiroTuristico"
                        className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                      />
                      <p className="text-xs text-zinc-400 mt-2 ml-1">Use hashtags separadas por vírgula para cadastrar circuitos e eventos exclusivos de busca.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Localização no Mapa</h4>
                <div className="space-y-4">
                  <button 
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all disabled:opacity-50"
                  >
                    {isLocating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                    Obter Localização Atual
                  </button>
                  
                  <div className="relative">
                    <input 
                      type="url"
                      value={formData.mapsLink}
                      onChange={e => {
                        const val = e.target.value;
                        const coords = extractCoordinatesFromMapsLink(val);
                        if (coords) {
                          const cleanedLat = cleanAndParseCoordinate(coords.latitude, currentCity?.latitude) || coords.latitude;
                          const cleanedLng = cleanAndParseCoordinate(coords.longitude, currentCity?.longitude) || coords.longitude;
                          setFormData(prev => ({
                            ...prev,
                            mapsLink: val,
                            latitude: cleanedLat,
                            longitude: cleanedLng
                          }));
                          alert("Coordenadas geográficas extraídas com sucesso do link do Google Maps!");
                        } else {
                          setFormData(prev => ({...prev, mapsLink: val}));
                        }
                      }}
                      placeholder="Inserir Link do Google Maps"
                      className="w-full px-6 py-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                    />
                  </div>

                   {isAdmin && (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="text"
                          value={formData.plusCode}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData(prev => ({...prev, plusCode: val}));
                            // Silently auto-resolve coordinates when valid codes are pasted or typed
                            resolveAndSetPlusCode(val, false);
                          }}
                          placeholder="Inserir Plus Code (ex: 8FVC9G8F+6X)"
                          className="w-full px-6 py-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleResolvePlusCode}
                        className="px-6 py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all flex items-center gap-2"
                      >
                        <Hash className="w-4 h-4" />
                        Resolver
                      </button>
                    </div>
                  )}

                  {isAdmin && (
                    <>
                      <button 
                        type="button"
                        onClick={() => setShowManualCoords(!showManualCoords)}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-4 border rounded-2xl text-sm font-bold transition-all ${
                          showManualCoords 
                            ? "bg-zinc-900 text-white border-zinc-900" 
                            : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                        }`}
                      >
                        <Compass className="w-5 h-5" />
                        Inserir Coordenadas Manualmente
                      </button>

                      {showManualCoords && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Latitude</label>
                            <input 
                              type="text"
                              value={formData.latitude === null || formData.latitude === undefined ? '' : String(formData.latitude)}
                              onChange={e => setFormData({...formData, latitude: e.target.value})}
                              placeholder="-23.5505"
                              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Longitude</label>
                            <input 
                              type="text"
                              value={formData.longitude === null || formData.longitude === undefined ? '' : String(formData.longitude)}
                              onChange={e => setFormData({...formData, longitude: e.target.value})}
                              placeholder="-46.6333"
                              className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  {formData.latitude && !showManualCoords && (
                    <p className="text-xs text-emerald-600 font-medium text-center">
                      Coordenadas capturadas: {cleanAndParseCoordinate(formData.latitude, currentCity?.latitude)?.toFixed(4)}, {cleanAndParseCoordinate(formData.longitude, currentCity?.longitude)?.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Horário de Funcionamento</h4>
                    <button
                      type="button"
                      onClick={handleSuggestHours}
                      disabled={isSuggestingHours || !formData.name || formData.is_open_24_hours}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#00897b] hover:text-[#00796b] transition-colors disabled:opacity-50"
                    >
                      {isSuggestingHours ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      Sugerir via IA
                    </button>
                  </div>

                  <button 
                    type="button"
                    onClick={() => setIsHoursExpanded(!isHoursExpanded)}
                    disabled={formData.is_open_24_hours}
                    className={`w-full flex items-center justify-between px-6 py-4 bg-white border border-zinc-200 rounded-2xl hover:bg-zinc-50 transition-all font-bold text-zinc-700 text-sm ${
                      formData.is_open_24_hours ? 'opacity-55 cursor-not-allowed' : 'active:scale-98'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[#00897b]" />
                      <span>Configurar Horários por Dia</span>
                      <span className="text-xs font-normal text-zinc-400">
                        ({formData.is_open_24_hours ? 'Aberto 24 horas' : `${openingHours.filter(h => !h.closed).length} dias ativos`})
                      </span>
                    </div>
                    {isHoursExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                  </button>

                  <AnimatePresence>
                    {isHoursExpanded && !formData.is_open_24_hours && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-zinc-50 rounded-3xl border border-zinc-100 overflow-hidden">
                          <div className="p-2 sm:p-4 space-y-4">
                            {openingHours.map((h) => (
                              <div key={h.day} className="flex flex-col gap-3 p-4 bg-white sm:bg-transparent rounded-2xl sm:rounded-none border border-zinc-100 sm:border-0 sm:border-b sm:border-zinc-100 last:border-0 shadow-sm sm:shadow-none">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-zinc-700 sm:w-24">{h.label}</span>
                                    {!h.closed && (
                                      <button
                                        type="button"
                                        onClick={() => copyToAll(h.day)}
                                        className="p-1.5 text-zinc-400 hover:text-[#00897b] transition-colors hidden sm:block"
                                        title="Copiar para todos os dias"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                  
                                  <button
                                    type="button"
                                    onClick={() => handleHourChange(h.day, 'closed', !h.closed)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shrink-0 ${
                                      h.closed 
                                        ? "bg-[#00897b] text-white shadow-lg shadow-[#00897b]/20" 
                                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                    }`}
                                  >
                                    {h.closed ? "Abrir" : "Fechar"}
                                  </button>
                                </div>

                                {!h.closed && (
                                  <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    {h.slots.map((slot, idx) => (
                                      <div key={idx} className="flex items-start sm:items-center gap-2">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase ml-1">De</span>
                                            <input 
                                              type="time"
                                              value={slot.open}
                                              onChange={(e) => handleHourChange(h.day, 'open', e.target.value, idx)}
                                              className="w-full px-3 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
                                            />
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase ml-1">Até</span>
                                            <input 
                                              type="time"
                                              value={slot.close}
                                              onChange={(e) => handleHourChange(h.day, 'close', e.target.value, idx)}
                                              className="w-full px-3 py-3 bg-zinc-50 border border-zinc-100 rounded-xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
                                            />
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 pt-5 sm:pt-0">
                                          {h.slots.length > 1 && (
                                            <button 
                                              type="button"
                                              onClick={() => removeSlot(h.day, idx)}
                                              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                              <X className="w-5 h-5" />
                                            </button>
                                          )}
                                          {idx === h.slots.length - 1 && (
                                            <button 
                                              type="button"
                                              onClick={() => addSlot(h.day)}
                                              className="p-2 text-[#00897b] hover:bg-[#00897b]/10 rounded-lg transition-all"
                                              title="Adicionar intervalo"
                                            >
                                              <Plus className="w-5 h-5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                    
                                    <button
                                      type="button"
                                      onClick={() => copyToAll(h.day)}
                                      className="sm:hidden flex items-center justify-center gap-2 py-2 text-xs font-bold text-zinc-400 border border-dashed border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      Copiar para todos os dias
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <label className="flex items-center gap-3 mt-3 ml-1 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox"
                        checked={formData.is_open_24_hours}
                        onChange={e => {
                          const checked = e.target.checked;
                          setFormData({
                            ...formData, 
                            is_open_24_hours: checked,
                            hours: checked ? 'Aberto 24 horas' : formatHoursSummary()
                          });
                        }}
                        className="peer appearance-none w-5 h-5 border-2 border-zinc-200 rounded-lg checked:bg-[#00897b] checked:border-[#00897b] transition-all cursor-pointer"
                      />
                      <CheckCircle2 className="w-3 h-3 text-white absolute left-1 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <span className="text-sm font-bold text-zinc-600 group-hover:text-zinc-900 transition-colors">Aberto 24 horas</span>
                  </label>
                </div>

                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Descrição do Local</h4>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Conte um pouco sobre o que o estabelecimento oferece..."
                    className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base h-48 resize-none"
                  />
                </div>

              {isAdmin && (
                <div className="space-y-6 p-8 bg-zinc-50 rounded-[32px] border border-zinc-100">
                  <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Configurações de Administrador</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-2xl cursor-pointer hover:border-emerald-200 transition-all">
                      <input 
                        type="checkbox"
                        checked={formData.is_verified}
                        onChange={e => setFormData({...formData, is_verified: e.target.checked})}
                        className="w-5 h-5 text-emerald-600 rounded-lg focus:ring-emerald-500"
                      />
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm font-bold text-zinc-700">Verificado</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-2xl cursor-pointer hover:border-orange-200 transition-all">
                      <input 
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={e => setFormData({...formData, is_featured: e.target.checked})}
                        className="w-5 h-5 text-orange-500 rounded-lg focus:ring-orange-500"
                      />
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-bold text-zinc-700">Destaque</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-2xl cursor-pointer hover:border-yellow-200 transition-all">
                      <input 
                        type="checkbox"
                        checked={formData.is_premium}
                        onChange={e => setFormData({...formData, is_premium: e.target.checked})}
                        className="w-5 h-5 text-yellow-600 rounded-lg focus:ring-yellow-500"
                      />
                      <div className="flex items-center gap-2">
                        <Crown className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm font-bold text-zinc-700">Premium</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-8 border-t border-zinc-100 bg-white -mx-8 -mb-8 p-8 flex flex-col sm:flex-row items-center justify-end gap-6">
                <div className="flex gap-4 w-full sm:w-auto">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-6 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 sm:flex-none px-10 py-4 bg-[#00897b] text-white rounded-2xl text-sm font-bold hover:bg-[#00796b] transition-all shadow-xl shadow-[#00897b]/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-95"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {initialData ? 'Salvar Alterações' : 'Publicar Agora'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
