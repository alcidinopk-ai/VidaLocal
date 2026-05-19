import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, User as UserIcon, Shield, ShieldAlert, Loader2, Pencil, Trash2, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
  id: string;
  role: 'admin' | 'user';
  email?: string | null;
  full_name?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  managed_establishment_short_id?: string | null;
}

export const UserManagementModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

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

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;

    setIsUpdating(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Error deleting user:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdating(editingUser.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUser.full_name,
          city: editingUser.city,
          state: editingUser.state,
          phone: editingUser.phone,
          managed_establishment_short_id: editingUser.managed_establishment_short_id
        })
        .eq('id', editingUser.id);

      if (error) {
        // Tratar erro específico de coluna inexistente (Schema Cache)
        if (error.code === 'PGRST204' || error.message?.includes('managed_establishment_short_id')) {
          alert("⚠️ Ação necessária no Supabase!\n\nA coluna 'managed_establishment_short_id' não foi encontrada no banco de dados.\n\nPor favor, execute este comando no SQL Editor do Supabase:\n\nALTER TABLE profiles ADD COLUMN managed_establishment_short_id TEXT;");
          return;
        }
        throw error;
      }
      
      setUsers(prev => prev.map(u => u.id === editingUser.id ? editingUser : u));
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error updating user:', err);
      alert('Erro ao atualizar usuário: ' + (err.message || 'Erro desconhecido'));
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
                        onClick={() => setEditingUser(user)}
                        className="p-2 text-zinc-400 hover:text-[#00897b] hover:bg-[#00897b]/10 rounded-xl transition-all"
                        title="Editar / Visualizar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => deleteUser(user.id)}
                        disabled={isUpdating === user.id || user.id === currentUser?.id}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="w-px h-6 bg-zinc-100 mx-1 hidden sm:block" />

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

        {/* Edit Modal Overlay */}
        <AnimatePresence>
          {editingUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#00897b]/10 flex items-center justify-center text-[#00897b]">
                      <Pencil className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">Editar Cadastro</h3>
                      <p className="text-xs text-zinc-500">{editingUser.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>

                <form onSubmit={handleUpdateUser} className="p-8 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nome Completo</label>
                      <input 
                        value={editingUser.full_name || ''}
                        onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cidade</label>
                        <input 
                          value={editingUser.city || ''}
                          onChange={e => setEditingUser({ ...editingUser, city: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Estado (UF)</label>
                        <input 
                          value={editingUser.state || ''}
                          onChange={e => setEditingUser({ ...editingUser, state: e.target.value })}
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Telefone</label>
                      <input 
                        value={editingUser.phone || ''}
                        onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00897b]/10 focus:border-[#00897b] transition-all text-sm"
                      />
                    </div>

                    {isAdmin && (
                      <div className="space-y-1.5 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                        <label className="text-[10px] font-bold text-orange-600 uppercase tracking-widest ml-1">Vincular Estabelecimentos (Somente Admin)</label>
                        <input 
                          value={editingUser.managed_establishment_short_id || ''}
                          onChange={e => setEditingUser({ ...editingUser, managed_establishment_short_id: e.target.value })}
                          placeholder="Ex: AD123, BC456 (IDs Curtos)"
                          className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 transition-all text-sm font-mono mt-1"
                        />
                        <p className="text-[9px] text-orange-500 mt-1 ml-1 uppercase font-bold tracking-tight">Vincule um ou mais estabelecimentos por ID Curto (separados por vírgula) para conceder acesso total.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="flex-1 py-4 text-zinc-500 font-bold hover:bg-zinc-100 rounded-2xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={isUpdating === editingUser.id}
                      className="flex-[2] py-4 bg-[#00897b] text-white rounded-2xl font-bold hover:bg-[#00796b] transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center justify-center"
                    >
                      {isUpdating === editingUser.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Salvar Alterações'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};
