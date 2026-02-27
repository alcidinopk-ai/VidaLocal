import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCity } from '../contexts/CityContext';
import { useAuth } from '../contexts/AuthContext';
import { CATEGORIES, SUB_CATEGORIES } from '../constants/taxonomy';

interface RegisterEstablishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RegisterEstablishmentModal: React.FC<RegisterEstablishmentModalProps> = ({ isOpen, onClose }) => {
  const { currentCity } = useCity();
  const { user } = useAuth();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    mapsLink: ''
  });

  const [isLocating, setIsLocating] = useState(false);

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
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/establishments/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cityId: currentCity.id,
          cityName: currentCity.name,
          cityUf: currentCity.uf,
          userId: user?.id,
          userEmail: user?.email
        })
      });

      if (response.ok) {
        setIsSubmitted(true);
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
            mapsLink: ''
          });
        }, 3000);
      }
    } catch (error) {
      console.error("Error registering establishment:", error);
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
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00897b] flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Cadastrar Estabelecimento</h2>
              <p className="text-[10px] text-zinc-500">Sugerir novo local em {currentCity.name} - {currentCity.uf}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSubmitted ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900">Solicitação Enviada!</h3>
              <p className="text-zinc-500 mt-3 max-w-md mx-auto">
                Obrigado por contribuir! Seu cadastro foi enviado para nossa equipe e passará por uma **validação administrativa**. 
                Assim que aprovado, ele ficará visível para todos os usuários do VidaLocal.
              </p>
              <button 
                onClick={onClose}
                className="mt-8 px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Informações Básicas</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Nome do Estabelecimento *</label>
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Pizzaria Bella Italia"
                        className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Categoria *</label>
                      <select 
                        required
                        value={formData.categoryId}
                        onChange={e => setFormData({...formData, categoryId: e.target.value, subCategory: ''})}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Tipo *</label>
                      <select 
                        required
                        disabled={!formData.categoryId}
                        value={formData.subCategory}
                        onChange={e => setFormData({...formData, subCategory: e.target.value})}
                        className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm appearance-none disabled:opacity-50"
                      >
                        <option value="">Selecione...</option>
                        {filteredSubCategories.map(sc => (
                          <option key={sc.name} value={sc.name}>{sc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact & Location */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Contato e Localização</h4>
                  
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Endereço Completo</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="text"
                        value={formData.address}
                        onChange={e => setFormData({...formData, address: e.target.value})}
                        placeholder="Rua, Número, Bairro"
                        className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                          type="tel"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="(00) 00000-0000"
                          className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">WhatsApp</label>
                      <div className="relative">
                        <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input 
                          type="tel"
                          value={formData.whatsapp}
                          onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                          placeholder="(00) 00000-0000"
                          className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="url"
                        value={formData.website}
                        onChange={e => setFormData({...formData, website: e.target.value})}
                        placeholder="https://..."
                        className="w-full pl-11 pr-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Localização no Mapa</h4>
                <div className="space-y-3">
                  <button 
                    type="button"
                    onClick={handleGetCurrentLocation}
                    disabled={isLocating}
                    className="w-full flex items-center justify-center gap-3 p-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition-all disabled:opacity-50"
                  >
                    {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                    Obter Localização Atual
                  </button>
                  
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="url"
                      value={formData.mapsLink}
                      onChange={e => setFormData({...formData, mapsLink: e.target.value})}
                      placeholder="Inserir Link do Google Maps"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm"
                    />
                  </div>
                  
                  {formData.latitude && (
                    <p className="text-[10px] text-emerald-600 font-medium text-center">
                      Coordenadas capturadas: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Detalhes Adicionais</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Horário de Funcionamento</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-4 w-4 h-4 text-zinc-400" />
                      <textarea 
                        value={formData.hours}
                        onChange={e => setFormData({...formData, hours: e.target.value})}
                        placeholder="Ex: Seg-Sex: 08h às 18h"
                        className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm h-24 resize-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5 ml-1">Descrição do Local</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Conte um pouco sobre o que o estabelecimento oferece..."
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl focus:ring-2 focus:ring-[#00897b]/20 transition-all text-sm h-24 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-zinc-400">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-[10px] font-medium uppercase">Fotos poderão ser adicionadas após validação</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="px-5 py-2 bg-[#00897b] text-white rounded-xl text-xs font-bold hover:bg-[#00796b] transition-all shadow-md shadow-[#00897b]/10 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                    Enviar para Validação
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
