import React, { useState } from 'react';
import { suggestBusinessHours } from '../services/geminiService';
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
  Wand2
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
    subCategory: '',
    address: '',
    phone: '',
    whatsapp: '',
    website: '',
    hours: '',
    description: '',
    latitude: null as number | null,
    longitude: null as number | null,
    mapsLink: '',
    is_featured: false,
    is_verified: false,
    is_premium: false
  });

  React.useEffect(() => {
    if (initialData && isOpen) {
      setFormData({
        name: initialData.title || '',
        categoryId: String(initialData.categoryId || ''),
        subCategory: initialData.subCategory || '',
        address: initialData.address || '',
        phone: initialData.phone || '',
        whatsapp: initialData.whatsapp || '',
        website: initialData.website || '',
        hours: initialData.hours || '',
        description: initialData.description || '',
        latitude: initialData.location?.latitude || null,
        longitude: initialData.location?.longitude || null,
        mapsLink: initialData.uri || '',
        is_featured: initialData.is_featured || false,
        is_verified: initialData.is_verified || false,
        is_premium: initialData.is_premium || false
      });
    } else if (!initialData && isOpen) {
      setFormData({
        name: '',
        categoryId: '',
        subCategory: '',
        address: '',
        phone: '',
        whatsapp: '',
        website: '',
        hours: '',
        description: '',
        latitude: null,
        longitude: null,
        mapsLink: '',
        is_featured: false,
        is_verified: false,
        is_premium: false
      });
    }
  }, [initialData, isOpen]);

  const [isLocating, setIsLocating] = useState(false);
  const [isSuggestingHours, setIsSuggestingHours] = useState(false);

  const handleSuggestHours = async () => {
    if (!formData.name) {
      setError("Por favor, informe o nome do estabelecimento primeiro.");
      return;
    }
    
    setIsSuggestingHours(true);
    setError(null);
    
    try {
      const suggested = await suggestBusinessHours(
        formData.name, 
        currentCity.name, 
        formData.address
      );
      
      if (suggested) {
        setFormData(prev => ({ ...prev, hours: suggested }));
      } else {
        setError("Não consegui encontrar os horários automaticamente. Por favor, preencha manualmente.");
      }
    } catch (err) {
      console.error("Error suggesting hours:", err);
      setError("Erro ao buscar horários. Tente preencher manualmente.");
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

  const filteredSubCategories = SUB_CATEGORIES.filter(
    sc => sc.categoryId === Number(formData.categoryId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Register] Submit triggered");
    
    if (!user) {
      console.error("[Register] No user found in context");
      setError("Você precisa estar logado para cadastrar um local.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        ...formData,
        cityId: initialData?.cityId || currentCity.id,
        cityName: initialData?.cityName || currentCity.name,
        cityUf: initialData?.cityUf || currentCity.uf,
        cityLat: initialData?.cityLat || currentCity.latitude,
        cityLng: initialData?.cityLng || currentCity.longitude,
        userId: user.id,
        userEmail: user.email
      };
      
      console.log("[Register] Sending payload:", payload);

      const url = initialData 
        ? `/api/establishments/${initialData.id}` 
        : '/api/establishments/register';
      
      const response = await fetch(url, {
        method: initialData ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log("[Register] Response status:", response.status);
      const result = await response.json();
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
            subCategory: '',
            address: '',
            phone: '',
            whatsapp: '',
            website: '',
            hours: '',
            description: '',
            latitude: null,
            longitude: null,
            mapsLink: '',
            is_featured: false,
            is_verified: false,
            is_premium: false
          });
        }, 3000);
      } else {
        setError(result.error || result.message || "Ocorreu um erro ao cadastrar.");
      }
    } catch (error: any) {
      console.error("[Register] Connection error:", error);
      setError("Erro de conexão com o servidor. Verifique sua internet e tente novamente.");
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
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white">
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
        <div className="flex-1 overflow-y-auto p-8">
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
                          onChange={e => setFormData({...formData, categoryId: e.target.value, subCategory: ''})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base appearance-none"
                        >
                          <option value="">Selecione...</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Tipo *</label>
                        <select 
                          required
                          disabled={!formData.categoryId}
                          value={formData.subCategory}
                          onChange={e => setFormData({...formData, subCategory: e.target.value})}
                          className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base appearance-none disabled:opacity-50"
                        >
                          <option value="">Selecione...</option>
                          {filteredSubCategories.map(sc => (
                            <option key={sc.name} value={sc.name}>{sc.name}</option>
                          ))}
                        </select>
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
                  
                  {formData.latitude && (
                    <p className="text-xs text-emerald-600 font-medium text-center">
                      Coordenadas capturadas: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-8">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-[0.2em]">Detalhes Adicionais</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="block text-sm font-bold text-zinc-700">Horário de Funcionamento</label>
                      <button
                        type="button"
                        onClick={handleSuggestHours}
                        disabled={isSuggestingHours || !formData.name}
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
                    <textarea 
                      value={formData.hours}
                      onChange={e => setFormData({...formData, hours: e.target.value})}
                      placeholder="Ex: Seg-Sex: 08h às 18h"
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base h-32 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2 ml-1">Descrição do Local</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Conte um pouco sobre o que o estabelecimento oferece..."
                      className="w-full px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-base h-32 resize-none"
                    />
                  </div>
                </div>
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
