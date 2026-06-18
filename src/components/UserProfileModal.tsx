import React, { useState, useEffect } from 'react';
import { X, User, Phone, MapPin, AlignLeft, Camera, Loader2, Save, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IBGEState {
  id: number;
  sigla: string;
  nome: string;
}

interface IBGECity {
  id: number;
  nome: string;
}

export const UserProfileModal = ({ isOpen, onClose }: UserProfileModalProps) => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [allStates, setAllStates] = useState<IBGEState[]>([]);
  const [cities, setCities] = useState<IBGECity[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    state: '',
    city: '',
    bio: '',
    avatar_url: ''
  });

  // Fetch all states when modal is opened
  useEffect(() => {
    if (!isOpen) return;
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const data = await response.json();
        setAllStates(data);
      } catch (err) {
        console.error('Error fetching states:', err);
      } finally {
        setLoadingStates(false);
      }
    };
    fetchStates();
  }, [isOpen]);

  // Fetch cities when state changes
  useEffect(() => {
    if (!isOpen) return;
    const fetchCities = async () => {
      if (!formData.state) {
        setCities([]);
        return;
      }
      setLoadingCities(true);
      try {
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.state}/municipios?orderBy=nome`);
        const data = await response.json();
        setCities(data);
      } catch (err) {
        console.error('Error fetching cities:', err);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [formData.state, isOpen]);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: profile.email || user?.email || '',
        phone: profile.phone || '',
        state: profile.state || '',
        city: profile.city || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || ''
      });
    }
  }, [profile, user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          state: formData.state,
          city: formData.city,
          bio: formData.bio,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Erro ao atualizar perfil. Talvez a coluna "state" precise ser adicionada à tabela "profiles".');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[85vh]"
      >
        <div className="p-4 sm:p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00897b] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">Meu Perfil</h2>
              <p className="text-[10px] sm:text-xs text-zinc-500">Gerencie suas informações</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-xl transition-all text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="profile-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-medium flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
              Perfil atualizado com sucesso!
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center overflow-hidden shadow-inner group-hover:border-[#00897b] transition-all">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-10 h-10 text-zinc-300" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white p-2 rounded-xl shadow-lg border border-zinc-100 text-[#00897b]">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Nome Completo
              </label>
              <input 
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                placeholder="Seu nome"
                className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Email
              </label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <Phone className="w-3 h-3" /> Telefone
              </label>
              <input 
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Estado
              </label>
              <div className="relative">
                <select 
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value, city: ''})}
                  className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium appearance-none pr-10"
                  disabled={loadingStates}
                >
                  <option value="">Selecione</option>
                  {allStates.map(st => (
                    <option key={st.id} value={st.sigla}>{st.nome}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {loadingStates ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Cidade
              </label>
              <div className="relative">
                <select 
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium appearance-none pr-10"
                  disabled={!formData.state || loadingCities}
                >
                  <option value="">{formData.state ? 'Selecione' : 'Selecione o Estado'}</option>
                  {cities.map(ct => (
                    <option key={ct.id} value={ct.nome}>{ct.nome}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {loadingCities ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <Camera className="w-3 h-3" /> URL do Avatar
              </label>
              <input 
                type="url"
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                placeholder="https://..."
                className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1 flex items-center gap-1">
                <AlignLeft className="w-3 h-3" /> Bio / Descrição
              </label>
              <textarea 
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                placeholder="Conte um pouco sobre você..."
                rows={3}
                className="w-full px-4 py-2.5 sm:py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:ring-2 focus:ring-[#00897b]/20 transition-all font-medium resize-none"
              />
            </div>
          </div>
        </form>

        <div className="p-4 sm:p-6 border-t border-zinc-100 bg-white shrink-0">
          <button 
            form="profile-form"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 bg-[#00897b] text-white rounded-2xl font-bold hover:bg-[#00796b] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
