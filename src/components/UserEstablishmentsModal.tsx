import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Store,
  MapPin,
  Calendar,
  Shield,
  Edit,
  Trash2,
  Heart,
  ExternalLink,
  Navigation2,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { AdminPermissionsModal } from './AdminPermissionsModal';
import { RegisterEstablishmentModal } from './RegisterEstablishmentModal';
import { parseImageArray } from '../utils/imageCompression';

interface UserEstablishmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Establishment {
  id: string;
  short_id?: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  address: string;
  sub_category: string;
  created_at: string;
  images?: any;
  website?: string;
  phone?: string;
  whatsapp?: string;
}

export const UserEstablishmentsModal: React.FC<UserEstablishmentsModalProps> = ({ isOpen, onClose }) => {
  const { user, role } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<'cadastros' | 'favoritos'>('favoritos');
  const isAdmin = user && (role === 'admin' || user.email === 'alcidinopk@gmail.com');
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [establishmentToDelete, setEstablishmentToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      fetchUserEstablishments();
    }
  }, [isOpen, user]);

  const fetchUserEstablishments = async () => {
    if (!user) {
      console.warn("[UserEst] No user found to fetch establishments");
      return;
    }
    
    console.log("[UserEst] Fetching establishments for user:", user.id);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/establishments/user/${user.id}?t=${Date.now()}`);
      const data = await response.json();
      
      console.log("[UserEst] Response received:", data);
      
      if (response.ok) {
        const activeEsts = Array.isArray(data) 
          ? data.filter((e: any) => e.status !== 'deleted' && !e.deleted)
          : [];
        setEstablishments(activeEsts);
      } else {
        setError(data.error || data.message || "Erro ao carregar seus cadastros.");
      }
    } catch (error: any) {
      console.error("[UserEst] Fetch error:", error);
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const openPermissions = (est: Establishment) => {
    setSelectedEstablishment(est);
    setIsPermissionsModalOpen(true);
  };

  const handleEdit = (est: any) => {
    setSelectedEstablishment({
      ...est,
      categoryId: est.category_id,
      uri: est.maps_link,
      plusCode: est.plus_code,
      location: {
        latitude: est.latitude,
        longitude: est.longitude
      }
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (est: any) => {
    setEstablishmentToDelete(est);
    setDeleteError(null);
    setDeleteSuccess(false);
  };

  const executeDelete = async () => {
    if (!establishmentToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/establishments/${establishmentToDelete.id}`, {
        method: 'DELETE',
        headers: { 
          'x-user-id': user?.id || '',
          'x-user-email': user?.email || ''
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setDeleteSuccess(true);
        
        // Emit custom event so that all other loaded lists/views remove this establishment immediately
        window.dispatchEvent(new CustomEvent('vida360:establishment-updated', { 
          detail: { id: establishmentToDelete.id, deleted: true, status: 'deleted' } 
        }));

        // Instantly remove from local state for ultimate responsiveness
        setEstablishments(prev => prev.filter(e => e.id !== establishmentToDelete.id));

        setTimeout(() => {
          setEstablishmentToDelete(null);
          setDeleteSuccess(false);
          fetchUserEstablishments();
        }, 1500);
      } else {
        setDeleteError(data.error || "Erro ao excluir estabelecimento.");
      }
    } catch (err) {
      console.error("[UserEst] Error deleting:", err);
      setDeleteError("Não foi possível conectar ao servidor.");
    } finally {
      setIsDeleting(false);
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
        <div className="p-4 border-b border-zinc-100 flex flex-col gap-3 bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00897b] flex items-center justify-center text-white">
                {activeTab === 'favoritos' ? <Heart className="w-5 h-5 fill-white text-white" /> : <Store className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Meus Locais</h2>
                <p className="text-[10px] text-zinc-500">
                  {activeTab === 'favoritos' 
                    ? 'Acompanhe os seus estabelecimentos favoritos salvos' 
                    : 'Acompanhe o status das suas sugestões enviadas'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-zinc-100/80 p-1 rounded-2xl border border-zinc-200/50">
            <button
              onClick={() => setActiveTab('favoritos')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'favoritos'
                  ? 'bg-white text-rose-600 shadow-sm border border-zinc-100/55'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${activeTab === 'favoritos' ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'}`} />
              Favoritos
              {favorites.length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  activeTab === 'favoritos' ? 'bg-rose-50 text-rose-600' : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {favorites.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('cadastros')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'cadastros'
                  ? 'bg-white text-zinc-900 shadow-sm border border-zinc-100/55'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Store className={`w-3.5 h-3.5 ${activeTab === 'cadastros' ? 'text-zinc-700' : 'text-zinc-400'}`} />
              Sugestões / Cadastros
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'favoritos' ? (
            favorites.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-400 mb-4">
                  <Heart className="w-8 h-8 fill-rose-100" />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">Sua lista está vazia</h3>
                <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto">
                  Adicione locais aos seus favoritos pressionando o coração nas fotos de qualquer estabelecimento!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {favorites.map((fav) => {
                  const maps = fav.maps;
                  if (!maps) return null;
                  const itemKey = maps.id || maps.short_id || Math.random().toString();
                  const subCat = maps.subCategory || maps.sub_category || 'Estabelecimento';
                  const rawImages = maps.images || [];
                  const parsedImgs = parseImageArray(rawImages);
                  const image = parsedImgs.find((img: any) => typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:image/'))) || null;

                  return (
                    <div 
                      key={itemKey} 
                      className="p-4 border border-zinc-100 rounded-2xl bg-zinc-50/20 hover:border-zinc-200 hover:shadow-xs transition-all group flex gap-4"
                    >
                      {/* Thumbnail Image */}
                      {image && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-100 bg-zinc-100">
                          <img 
                            src={image} 
                            alt={maps.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-zinc-900 truncate text-xs sm:text-sm">{maps.title}</h4>
                            
                            {/* Heart toggle button */}
                            <button
                              onClick={() => toggleFavorite(fav)}
                              className="p-1 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors shrink-0"
                              title="Remover dos favoritos"
                            >
                              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                            </button>
                          </div>
                          
                          <p className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-widest inline-block mt-0.5 mb-1.5">
                            {subCat}
                          </p>

                          {maps.address && (
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{maps.address}</span>
                            </div>
                          )}
                        </div>

                        {(maps.uri || maps.website) && (
                          <div className="flex items-center flex-wrap gap-3 mt-2 pt-0.5">
                            {maps.uri && (
                              <a 
                                href={maps.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-black text-[#00897b] hover:underline"
                              >
                                <Navigation2 className="w-2.5 h-2.5 fill-current" />
                                Ver no Google Maps
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </a>
                            )}
                            {maps.website && (
                              <a 
                                href={maps.website.startsWith('http') ? maps.website : `https://${maps.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] font-black text-emerald-600 hover:underline"
                              >
                                <Globe className="w-2.5 h-2.5" />
                                Visitar Website
                                <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            error ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">Ops! Algo deu errado</h3>
                <p className="text-sm text-zinc-500 mt-2 max-w-xs mx-auto">{error}</p>
                <button 
                  onClick={fetchUserEstablishments}
                  className="mt-6 px-6 py-2 bg-zinc-100 text-zinc-900 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : isLoading ? (
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
                {establishments.map((est) => {
                  const parsedImgs = parseImageArray(est.images);
                  const thumbImg = parsedImgs.find((img: any) => typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:image/'))) || null;
                  return (
                    <div 
                      key={est.id} 
                      className="p-4 border border-zinc-100 rounded-2xl hover:border-zinc-200 transition-all bg-zinc-50/30 flex gap-4 items-start"
                    >
                      {thumbImg && (
                        <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-zinc-100 bg-zinc-100">
                          <img 
                            src={thumbImg} 
                            alt={est.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-zinc-900 truncate">{est.name}</h4>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                              <MapPin className="w-3 h-3 text-zinc-400" />
                              <span className="truncate">{est.address || 'Endereço não informado'}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              <span>Sugerido em: {new Date(est.created_at).toLocaleDateString('pt-BR')}</span>
                            </div>
                            {est.website && (
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-emerald-600 font-bold">
                                <Globe className="w-3 h-3" />
                                <a 
                                  href={est.website.startsWith('http') ? est.website : `https://${est.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                >
                                  {est.website}
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusBadge status={est.status} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1 justify-end">
                          {(est.sub_category || '').split(est.sub_category?.includes(' | ') ? ' | ' : /,\s*(?![^()]*\))/).map((cat, idx) => (
                            <span key={idx} className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-widest">
                              {cat && typeof cat === 'string' ? cat.trim() : ''}
                            </span>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2 justify-end">
                          <button 
                            onClick={() => handleEdit(est)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg text-[10px] font-bold transition-all border border-zinc-200"
                          >
                            <Edit className="w-3 h-3 text-zinc-500" />
                            Editar
                          </button>
                          
                          <button 
                            onClick={() => handleDelete(est)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-all border border-red-100"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                            Excluir
                          </button>
  
                          {isAdmin && est.status === 'approved' && (
                            <button 
                              onClick={() => openPermissions(est)}
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all border border-emerald-100"
                            >
                              <Shield className="w-3 h-3 text-emerald-500" />
                              Gerenciar Acessos
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all border border-zinc-200"
          >
            Fechar
          </button>
        </div>
      </motion.div>

      <AdminPermissionsModal 
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        establishment={selectedEstablishment}
      />

      <RegisterEstablishmentModal 
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedEstablishment(null);
        }}
        initialData={selectedEstablishment}
        onSuccess={() => {
          setIsEditModalOpen(false);
          setSelectedEstablishment(null);
          fetchUserEstablishments();
        }}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {establishmentToDelete && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 text-center border border-zinc-100"
            >
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900 mb-2">Excluir Estabelecimento?</h2>
              <p className="text-sm text-zinc-500 mb-6 font-medium">
                Tem certeza que deseja excluir "{establishmentToDelete.name}"? Esta ação não pode ser desfeita.
              </p>
              
              {isDeleting ? (
                <div className="py-2 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
                  <span className="text-xs text-zinc-500 font-medium">Excluindo...</span>
                </div>
              ) : deleteSuccess ? (
                <div className="py-2 flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className="text-xs text-emerald-600 font-bold">Excluído com sucesso!</span>
                </div>
              ) : (
                <>
                  {deleteError && (
                    <div className="p-3 mb-4 bg-red-50 text-red-600 text-xs rounded-xl font-medium">
                      {deleteError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setEstablishmentToDelete(null);
                        setDeleteError(null);
                      }}
                      className="flex-1 py-3.5 bg-zinc-100 text-zinc-700 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-all text-center"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={executeDelete}
                      className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-600/10 text-center"
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
