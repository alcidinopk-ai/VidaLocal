import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  MapPin, 
  Phone, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

interface State {
  id: number;
  sigla: string;
  nome: string;
}

interface City {
  id: number;
  nome: string;
}

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    state: '',
    city: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch States on mount
  useEffect(() => {
    if (isOpen) {
      const fetchStates = async () => {
        setIsLoadingStates(true);
        try {
          const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
          const data = await response.json();
          setStates(data);
        } catch (err) {
          console.error('Error fetching states:', err);
        } finally {
          setIsLoadingStates(false);
        }
      };
      fetchStates();
    }
  }, [isOpen]);

  // Fetch Cities when State changes
  useEffect(() => {
    if (formData.state) {
      const fetchCities = async () => {
        setIsLoadingCities(true);
        try {
          const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.state}/municipios`);
          const data = await response.json();
          setCities(data);
        } catch (err) {
          console.error('Error fetching cities:', err);
        } finally {
          setIsLoadingCities(false);
        }
      };
      fetchCities();
    } else {
      setCities([]);
    }
  }, [formData.state]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear city if state changes
    if (name === 'state') {
      setFormData(prev => ({ ...prev, city: '' }));
    }
  };

  const validate = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            state: formData.state,
            city: formData.city,
            phone: formData.phone
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        setSuccess('Cadastro realizado com sucesso! Verifique seu e-mail para confirmar seu cadastro antes de fazer login!');
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao realizar o cadastro.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00897b] flex items-center justify-center text-white shadow-lg">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Fazer parte da comunidade</h2>
              <p className="text-xs text-zinc-500">Junte-se ao VidaLocal hoje mesmo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-8">
          {success ? (
            <div className="py-12 text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">Verifique seu e-mail</h3>
              <p className="text-zinc-600 mb-8 leading-relaxed">
                {success}
              </p>
              <button 
                onClick={onSwitchToLogin}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg"
              >
                Voltar para Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Personal Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      name="fullName"
                      required
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Seu nome"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="seu@email.com"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Estado (UF)</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" />
                    <select 
                      name="state"
                      required
                      value={formData.state}
                      onChange={handleChange}
                      disabled={isLoadingStates}
                      className="w-full pl-11 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm appearance-none"
                    >
                      <option value="">Selecione...</option>
                      {states.map(s => (
                        <option key={s.sigla} value={s.sigla}>{s.nome} ({s.sigla})</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    {isLoadingStates && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00897b] animate-spin" />}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cidade</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 z-10" />
                    <select 
                      name="city"
                      required
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!formData.state || isLoadingCities}
                      className="w-full pl-11 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm appearance-none disabled:bg-zinc-100 disabled:cursor-not-allowed"
                    >
                      <option value="">{formData.state ? 'Selecione...' : 'Selecione o estado'}</option>
                      {cities.map(c => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    {isLoadingCities && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00897b] animate-spin" />}
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Contatos (Telefone/WhatsApp)</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(XX) XXXXX-XXXX"
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                  />
                </div>
              </div>

              {/* Passwords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="password" 
                      name="password"
                      required
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Confirmar Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="password" 
                      name="confirmPassword"
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#00897b] text-white rounded-2xl font-bold hover:bg-[#00796b] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Confirmar Cadastro'
                )}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-xs font-bold text-zinc-500 hover:text-[#00897b] transition-colors"
                >
                  Já tem uma conta? Entre agora
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
