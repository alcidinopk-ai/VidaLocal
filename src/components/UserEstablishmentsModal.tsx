import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Store,
  MapPin,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface UserEstablishmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Establishment {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  address: string;
  sub_category: string;
  created_at: string;
}

export const UserEstablishmentsModal: React.FC<UserEstablishmentsModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserEstablishments();
    }
  }, [isOpen, user]);

  const fetchUserEstablishments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/establishments/user/${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setEstablishments(data);
      }
    } catch (error) {
      console.error("Error fetching user establishments:", error);
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
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f57c00] flex items-center justify-center text-white">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Meus Cadastros</h2>
              <p className="text-[10px] text-zinc-500">Acompanhe o status das suas sugestões</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p className="text-sm font-medium">Carregando seus cadastros...</p>
            </div>
          ) : establishments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Nenhum cadastro encontrado</h3>
              <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto">
                Você ainda não sugeriu nenhum estabelecimento. Comece agora clicando no botão de "+"!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {establishments.map((est) => (
                <div 
                  key={est.id} 
                  className="p-4 border border-zinc-100 rounded-2xl hover:border-zinc-200 transition-all bg-zinc-50/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-zinc-900 truncate">{est.name}</h4>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{est.address || 'Endereço não informado'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                        <Calendar className="w-3 h-3" />
                        <span>Sugerido em: {new Date(est.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={est.status} />
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                        {est.sub_category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: Establishment['status'] }> = ({ status }) => {
  const config = {
    pending: {
      icon: Clock,
      text: 'Pendente',
      className: 'bg-amber-50 text-amber-600 border-amber-100'
    },
    approved: {
      icon: CheckCircle2,
      text: 'Aprovado',
      className: 'bg-emerald-50 text-emerald-600 border-emerald-100'
    },
    rejected: {
      icon: AlertCircle,
      text: 'Recusado',
      className: 'bg-red-50 text-red-600 border-red-100'
    }
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${className}`}>
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
};
