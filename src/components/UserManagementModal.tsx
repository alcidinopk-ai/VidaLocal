import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, User as UserIcon, Shield, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
  id: string;
  role: 'admin' | 'user';
  email?: string | null;
  full_name?: string | null;
  city?: string | null;
  state?: string | null;
}

export const UserManagementModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const isAdmin = currentUser?.email === 'alcidinopk@gmail.com';

  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchUsers();
    }
  }, [isOpen, isAdmin]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: 'admin' | 'user') => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setIsUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-4xl bg-white rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900">Gestão de Usuários</h2>
              <p className="text-sm text-zinc-500 mt-1">Gerencie permissões e funções de todos os usuários do sistema.</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 text-zinc-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Filters */}
          <div className="p-8 pb-4 border-b border-zinc-100">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            </div>
          </div>

          {/* User List */}
          <div className="flex-1 overflow-y-auto p-8 pt-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#00897b] animate-spin mb-4" />
                <p className="text-sm text-zinc-500 font-medium">Buscando usuários...</p>
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div 
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-zinc-100 rounded-2xl hover:border-[#00897b]/30 hover:shadow-lg hover:shadow-zinc-100 transition-all gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${user.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-zinc-50 text-zinc-400'}`}>
                        {user.role === 'admin' ? <ShieldAlert className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                          {user.full_name || 'Usuário sem nome'}
                        </h4>
                        <p className="text-xs text-zinc-500 font-medium">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            user.role === 'admin' ? 'bg-orange-100 text-orange-600' : 'bg-zinc-100 text-zinc-500'
                          }`}>
                            {user.role}
                          </span>
                          {user.city && (
                            <span className="text-[10px] text-zinc-400">{user.city} - {user.state}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRole(user.id, user.role)}
                        disabled={isUpdating === user.id}
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          user.role === 'admin' 
                            ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' 
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'
                        }`}
                      >
                        {isUpdating === user.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : user.role === 'admin' ? (
                          <>
                            <Shield className="w-4 h-4" />
                            Remover Admin
                          </>
                        ) : (
                          <>
                            <ShieldAlert className="w-4 h-4" />
                            Tornar Admin
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                <p className="text-sm text-zinc-500">Nenhum usuário encontrado com esses termos.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
