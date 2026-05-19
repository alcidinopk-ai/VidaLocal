import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Mail, 
  Plus, 
  Trash2, 
  Loader2,
  Shield,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishment: {
    id: string;
    short_id?: string;
    name: string;
  } | null;
}

interface Permission {
  id: string;
  user_email: string;
  role: string;
  created_at: string;
}

export const AdminPermissionsModal: React.FC<AdminPermissionsModalProps> = ({ 
  isOpen, 
  onClose, 
  establishment 
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (isOpen && establishment?.short_id) {
      fetchPermissions();
    }
  }, [isOpen, establishment]);

  const fetchPermissions = async () => {
    if (!establishment?.short_id || !user) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/permissions/${establishment.short_id}`, {
        headers: { 'x-user-id': user.id }
      });
      
      const contentType = response.headers.get('content-type');
      if (response.ok && contentType && contentType.includes('application/json')) {
        const data = await response.json();
        setPermissions(data);
      } else if (!response.ok) {
        const text = await response.text();
        console.error('Error fetching permissions:', text);
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !establishment?.short_id || !user) return;

    setIsAdding(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user.id 
        },
        body: JSON.stringify({
          email: email.trim(),
          shortId: establishment.short_id,
          role: 'editor'
        })
      });

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Server returned non-JSON response:', text);
        throw new Error(`Servidor retornou resposta inesperada (${response.status})`);
      }

      if (response.ok) {
        setPermissions(prev => [...prev, data]);
        setEmail('');
        setMessage({ type: 'success', text: 'Permissão concedida com sucesso!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao conceder permissão.' });
      }
    } catch (error: any) {
      console.error('Permission error:', error);
      setMessage({ type: 'error', text: error.message || 'Erro de conexão com o servidor.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemovePermission = async (permId: string) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/admin/permissions/${permId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id }
      });

      if (response.ok) {
        setPermissions(prev => prev.filter(p => p.id !== permId));
      }
    } catch (error) {
      console.error('Error removing permission:', error);
    }
  };

  if (!isOpen || !establishment) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 leading-tight">Gestão de Acessos</h2>
              <p className="text-[10px] text-zinc-500 truncate max-w-[200px]">{establishment.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add User Section */}
          <div className="mb-8">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 block">
              Conceder acesso por E-mail
            </label>
            <form onSubmit={handleAddPermission} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@email.com"
                  className="w-full bg-zinc-50 border border-zinc-100 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isAdding}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 text-xs font-bold shadow-md shadow-emerald-100 active:scale-95"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Conceder
              </button>
            </form>
            
            <AnimatePresence>
              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-3 p-3 rounded-xl text-[11px] font-medium flex items-center gap-2 ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#f57c00]" />
                Usuários com Acesso
              </h3>
              <span className="text-[10px] text-zinc-400">ID Curto: <span className="font-mono font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">{establishment.short_id}</span></span>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
              </div>
            ) : permissions.length === 0 ? (
              <div className="py-12 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200 flex flex-col items-center justify-center text-center px-6">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Somente você (o criador) tem acesso a este estabelecimento no momento. Adicione editores acima.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {permissions.map((perm) => (
                  <div 
                    key={perm.id}
                    className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-100 rounded-2xl group hover:border-zinc-200 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500 font-bold text-xs uppercase">
                        {perm.user_email.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-900">{perm.user_email}</p>
                        <p className="text-[10px] text-zinc-400 capitalize">{perm.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemovePermission(perm.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remover acesso"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-md active:scale-95"
          >
            Concluído
          </button>
        </div>
      </motion.div>
    </div>
  );
};
