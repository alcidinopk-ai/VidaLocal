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
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCity } from '../contexts/CityContext';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, SUB_CATEGORIES } from '../constants/taxonomy';

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
  const { currentCity } = useCity();
  const { user, role } = useAuth();
  const isAdmin = user && role === 'admin';
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    latitude: null as number | null,
    longitude: null as number | null,
    mapsLink: '',
    plusCode: '',
    is_featured: false,
    is_verified: false,
    is_premium: false
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
    if (initialData && isOpen) {
      // Process subCategory into array if it's a string
      let subCats: string[] = [];
      if (initialData.subCategory) {
        if (Array.isArray(initialData.subCategory)) {
          subCats = initialData.subCategory;
        } else if (typeof initialData.subCategory === 'string') {
          subCats = initialData.subCategory.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else if (initialData.sub_category) {
        subCats = initialData.sub_category.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      setFormData({
        name: initialData.name || initialData.title || '',
        categoryId: String(initialData.categoryId || ''),
        subCategory: subCats,
        address: initialData.address || '',
        phone: initialData.phone || '',
        whatsapp: initialData.whatsapp || '',
        website: initialData.website || '',
        hours: initialData.hours || '',
        is_open_24_hours: initialData.is_open_24_hours || false,
        description: initialData.description || '',
        latitude: initialData.location?.latitude || null,
        longitude: initialData.location?.longitude || null,
        mapsLink: initialData.uri || '',
        plusCode: initialData.plusCode || '',
        is_featured: initialData.is_featured || false,
        is_verified: initialData.is_verified || false,
        is_premium: initialData.is_premium || false
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
        is_premium: false
      });
    }
  }, [initialData, isOpen]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSuggestingHours, setIsSuggestingHours] = useState(false);
  const [showManualCoords, setShowManualCoords] = useState(false);

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

  const handleResolvePlusCode = () => {
    if (!formData.plusCode.trim()) {
      alert("Por favor, insira um Plus Code.");
      return;
    }

    try {
      const olc = new OpenLocationCode();
      const decoded = olc.decode(formData.plusCode.trim());
      setFormData(prev => ({
        ...prev,
        latitude: decoded.latitudeCenter,
        longitude: decoded.longitudeCenter
      }));
      alert("Plus Code resolvido com sucesso!");
    } catch (err) {
      console.error("Plus Code resolution error:", err);
      alert("Plus Code inválido. Certifique-se de que é um código completo (ex: 8FVC9G8F+6X).");
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
    
    try {
      const payload = {
        ...formData,
        subCategory: formData.subCategory.join(', '),
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
      
      console.log("[Register] Sending payload:", payload);

      const isUpdate = initialData && initialData.id;
      const url = isUpdate 
        ? `/api/establishments/${initialData.id}` 
        : '/api/establishments/register';
      
      const response = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id
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
        console.error("[Register] Non-JSON response:", text);
        throw new Error(`Servidor retornou resposta inesperada (${response.status})`);
      }

      console.log("[Register] Result:", result);

      if (response.ok) {
        setIsSubmitted(true);
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
            plusCode: ''
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
                      onChange={e => setFormData({...formData, mapsLink: e.target.value})}
                      placeholder="Inserir Link do Google Maps"
                      className="w-full px-6 py-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="text"
                        value={formData.plusCode}
                        onChange={e => setFormData({...formData, plusCode: e.target.value})}
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
                          type="number"
                          step="any"
                          value={formData.latitude || ''}
                          onChange={e => setFormData({...formData, latitude: e.target.value ? parseFloat(e.target.value) : null})}
                          placeholder="-23.5505"
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Longitude</label>
                        <input 
                          type="number"
                          step="any"
                          value={formData.longitude || ''}
                          onChange={e => setFormData({...formData, longitude: e.target.value ? parseFloat(e.target.value) : null})}
                          placeholder="-46.6333"
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base"
                        />
                      </div>
                    </div>
                  )}
                  
                  {formData.latitude && !showManualCoords && (
                    <p className="text-xs text-emerald-600 font-medium text-center">
                      Coordenadas capturadas: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
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

                  <div className={`bg-zinc-50 rounded-3xl border border-zinc-100 overflow-hidden transition-opacity ${formData.is_open_24_hours ? 'opacity-50 pointer-events-none' : ''}`}>
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

              <div className="pt-8 border-t border-zinc-100 bg-white -mx-8 -mb-8 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3 text-zinc-400">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Fotos poderão ser adicionadas após validação</span>
                </div>
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
