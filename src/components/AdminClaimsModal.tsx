import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  MessageSquare,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface Claim {
  id: string;
  establishment_id: string;
  requester_user_id: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  requester_message: string;
  requester_role?: string;
  proof_document_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  establishments?: {
    id: string;
    name: string;
    address: string;
    short_id?: string;
    is_claimed?: boolean;
  };
}

export const AdminClaimsModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Resolve states
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const isAdmin = user?.email === 'alcidinopk@gmail.com';

  useEffect(() => {
    if (isOpen && isAdmin) {
      fetchClaims();
    }
  }, [isOpen, isAdmin]);

  const fetchClaims = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/business-claims', {
        headers: {
          'x-user-id': user?.id || '',
          'x-user-email': user?.email || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClaims(data || []);
      } else {
        toast.error("Não foi possível carregar as reivindicações de empresas.");
      }
    } catch (err) {
      console.error("[AdminClaimsModal] Error fetching claims:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (claimId: string, status: 'approved' | 'rejected', notes?: string) => {
    setResolvingId(claimId);
    try {
      const response = await fetch(`/api/admin/business-claims/${claimId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-user-email': user?.email || ''
        },
        body: JSON.stringify({
          status,
          admin_notes: notes || ''
        })
      });

      const resData = await response.json();

      if (response.ok) {
        toast.success(status === 'approved' ? "Reivindicação de empresa aprovada com sucesso!" : "Reivindicação de empresa recusada.");

        // Update locally
        setClaims(prev => prev.map(c => {
          if (c.id === claimId) {
            return {
              ...c,
              status,
              admin_notes: notes || c.admin_notes,
              reviewed_by: user?.id,
              reviewed_at: new Date().toISOString()
            };
          }
          return c;
        }));

        setShowRejectForm(null);
        setRejectionNotes('');
      } else {
        toast.error(resData.error || "Ocorreu um erro ao atualizar o status da reivindicação.");
      }
    } catch (err) {
      console.error("[AdminClaimsModal] Resolve claim error:", err);
      toast.error("Não foi possível se comunicar com o servidor.");
    } finally {
      setResolvingId(null);
    }
  };

  // Filter & Search
  const filteredClaims = claims.filter(c => {
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesSearch = 
      c.requester_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.requester_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.establishments?.name && c.establishments.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh] border border-zinc-100"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Painel de Reivindicações</h2>
            <p className="text-xs text-zinc-500 font-medium mt-0.5">Gerencie solicitações de proprietários para assumir a administração dos estabelecimentos.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Filters and search */}
        <div className="p-4 border-b border-zinc-100 bg-white flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por empresa or solicitante..."
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all"
            />
          </div>

          {/* Filters Status */}
          <div className="flex gap-1.5 bg-zinc-100 p-1 rounded-xl self-stretch md:self-auto overflow-x-auto">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  filterStatus === status 
                    ? 'bg-white text-zinc-900 shadow-sm' 
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {status === 'all' && 'Todos'}
                {status === 'pending' && 'Pendentes'}
                {status === 'approved' && 'Aprovados'}
                {status === 'rejected' && 'Recusados'}
              </button>
            ))}
          </div>
        </div>

        {/* Claims list */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-[#00897b] animate-spin" />
              <p className="text-xs font-bold text-zinc-500">Carregando solicitações...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-zinc-200/65">
              <Building2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h4 className="text-sm font-bold text-zinc-800 mb-1">Nenhuma reivindicação encontrada</h4>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">Não há registros na categoria selecionada ou com os critérios de buscas atuais.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => (
                <div 
                  key={claim.id} 
                  className="bg-white rounded-2xl shadow-sm border border-zinc-200/70 p-5 flex flex-col md:flex-row justify-between gap-6 hover:shadow-md hover:border-zinc-300/80 transition-all"
                >
                  {/* Left Column: Business & Requester Info */}
                  <div className="flex-1 space-y-4">
                    {/* Header - Claims info */}
                    <div className="flex items-start justify-between md:justify-start gap-4 flex-wrap">
                      <div>
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Empresa Reivindicada</span>
                        <h3 className="text-sm font-black text-zinc-900 flex items-center gap-2 mt-0.5">
                          <Building2 className="w-4 h-4 text-[#00897b] shrink-0" />
                          {claim.establishments?.name || "Estabelecimento Desconhecido"}
                        </h3>
                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5">{claim.establishments?.address}</p>
                      </div>

                      {/* Status Badges */}
                      <div className="md:ml-auto">
                        {claim.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-bold border border-amber-200">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                        {claim.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-bold border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Aprovada
                          </span>
                        )}
                        {claim.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-bold border border-red-200">
                            <XCircle className="w-3 h-3" /> Recusada
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t border-zinc-100" />

                    {/* Requester Profile Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-semibold text-zinc-700">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 font-medium">Nome:</span>
                        <span className="text-zinc-900 font-bold">{claim.requester_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 font-medium">E-mail:</span>
                        <a href={`mailto:${claim.requester_email}`} className="text-blue-600 hover:underline">{claim.requester_email}</a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 font-medium">Tel:</span>
                        <span className="text-zinc-900">{claim.requester_phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-zinc-400 shrink-0" />
                        <span className="text-zinc-500 font-medium">Data:</span>
                        <span className="text-zinc-900">{new Date(claim.created_at).toLocaleDateString()}</span>
                      </div>
                      {claim.requester_role && (
                        <div className="flex items-center gap-2 col-span-1 sm:col-span-2">
                          <span className="text-zinc-500 font-medium">Cargo/Relação:</span>
                          <span className="bg-zinc-100 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-600 truncate">{claim.requester_role}</span>
                        </div>
                      )}
                    </div>

                    {/* Message */}
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200/50">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase flex items-center gap-1 mb-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> Justificativa do solicitante
                      </span>
                      <p className="text-xs text-zinc-600 leading-relaxed italic">"{claim.requester_message}"</p>
                    </div>

                    {/* Proof Link */}
                    {claim.proof_document_url && (
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                        <FileText className="w-4 h-4" />
                        <a href={claim.proof_document_url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                          Visualizar documento de comprovação
                        </a>
                      </div>
                    )}

                    {/* Admin notes (if resolved) */}
                    {claim.admin_notes && (
                      <div className="p-3 bg-[#00897b]/5 border border-[#00897b]/10 text-[#00796b] rounded-xl text-xs">
                        <span className="font-bold block mb-1">Notas administrativas:</span>
                        <p>{claim.admin_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions (only for pending claims) */}
                  <div className="flex flex-col justify-center gap-2 md:w-44 shrink-0 border-t md:border-t-0 md:border-l border-zinc-100 pt-4 md:pt-0 md:pl-6">
                    {claim.status === 'pending' ? (
                      <>
                        {showRejectForm === claim.id ? (
                          <div className="space-y-2 w-full animate-fade-in-down">
                            <textarea
                              rows={2}
                              value={rejectionNotes}
                              onChange={(e) => setRejectionNotes(e.target.value)}
                              placeholder="Motivo da recusa..."
                              className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:outline-none focus:border-red-400 resize-none"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleResolve(claim.id, 'rejected', rejectionNotes)}
                                disabled={resolvingId === claim.id || !rejectionNotes.trim()}
                                className="flex-1 py-1 px-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold text-center"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => { setShowRejectForm(null); setRejectionNotes(''); }}
                                className="py-1 px-2.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 rounded-md text-[10px] font-bold text-center"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              disabled={resolvingId === claim.id}
                              onClick={() => handleResolve(claim.id, 'approved')}
                              className="w-full py-2.5 px-4 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:shadow-md flex items-center justify-center gap-1.5"
                            >
                              {resolvingId === claim.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Aprovar
                            </button>

                            <button
                              disabled={resolvingId === claim.id}
                              onClick={() => setShowRejectForm(claim.id)}
                              className="w-full py-2.5 px-4 bg-zinc-100 hover:bg-red-50 hover:text-red-600 text-zinc-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-zinc-200 flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Recusar
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="text-center md:py-6">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase block">Análise finalizada</span>
                        <p className="text-[9px] text-zinc-400 mt-1">Quando: {claim.reviewed_at ? new Date(claim.reviewed_at).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
