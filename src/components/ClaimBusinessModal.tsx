import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  Briefcase, 
  MessageSquare, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface ClaimBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  establishment: {
    id: string;
    name: string;
    address?: string;
  } | null;
  onSuccess?: () => void;
}

export const ClaimBusinessModal: React.FC<ClaimBusinessModalProps> = ({ 
  isOpen, 
  onClose, 
  establishment,
  onSuccess
}) => {
  const { user, profile, setIsAuthModalOpen } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleInCompany, setRoleInCompany] = useState('');
  const [message, setMessage] = useState('');
  const [proofDocumentUrl, setProofDocumentUrl] = useState('');
  
  // Drag and drop states for future file uploads
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClaimedSuccess, setIsClaimedSuccess] = useState(false);

  // Pre-fill fields with user info when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!user) {
        setIsAuthModalOpen(true);
        onClose();
        return;
      }
      setName(profile?.full_name || '');
      setEmail(profile?.email || user?.email || '');
      setPhone(profile?.phone || '');
      setRoleInCompany('');
      setMessage('');
      setProofDocumentUrl('');
      setSelectedFile(null);
      setError(null);
      setIsClaimedSuccess(false);
    }
  }, [isOpen, user, profile]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      // Mocking a future cloud uploaded document URL
      setProofDocumentUrl(`https://vidalocal.com/uploads/proof_${Date.now()}_${files[0].name}`);
      toast.success(`${files[0].name} foi anexado com sucesso.`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      setProofDocumentUrl(`https://vidalocal.com/uploads/proof_${Date.now()}_${files[0].name}`);
      toast.success(`${files[0].name} foi anexado com sucesso.`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishment) return;

    if (!name.trim() || !email.trim() || !phone.trim() || !roleInCompany.trim() || !message.trim()) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/business-claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-user-email': user?.email || ''
        },
        body: JSON.stringify({
          establishment_id: establishment.id,
          requester_name: name,
          requester_email: email,
          requester_phone: phone,
          requester_role: roleInCompany,
          requester_message: message,
          proof_document_url: proofDocumentUrl
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsClaimedSuccess(true);
        toast.success("Sua solicitação foi enviada para análise da equipe VidaLocal.");

        // Emit reload event
        window.dispatchEvent(new CustomEvent('vida360:establishment-updated', { 
          detail: { id: establishment.id, is_claimed: false, claim_pending: true } 
        }));

        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 4000);
      } else {
        setError(data.error || "Ocorreu um erro ao enviar sua solicitação.");
      }
    } catch (err) {
      console.error("[ClaimModal] Submit error:", err);
      setError("Erro de rede. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !establishment) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-base font-bold text-zinc-900 truncate">Reivindicar: {establishment.name}</h3>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Assuma a gestão deste local para mantê-lo atualizado.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {isClaimedSuccess ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 px-4 text-center flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-lg font-bold text-zinc-900 mb-3">Solicitação Recebida!</h4>
                <p className="text-xs text-zinc-600 max-w-sm leading-relaxed">
                  Sua solicitação foi enviada para análise da equipe <span className="font-bold text-[#00897b]">VidaLocal</span>.
                </p>
                <p className="text-[10px] text-zinc-400 mt-4">
                  Você receberá uma atualização por e-mail ou telefone em breve. Obrigado!
                </p>
              </motion.div>
            ) : (
              <motion.form 
                onSubmit={handleSubmit} 
                className="space-y-4"
              >
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl flex items-start gap-2.5 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form Group: Name */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Seu Nome Completo *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Alcidino Santos"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Two Column Row: E-mail & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">E-mail de Contato *</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="email" 
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Ex: joao@empresa.com"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Telefone Comercial *</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input 
                        type="tel" 
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ex: (63) 99999-9999"
                        className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Role in Company */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Seu Cargo / Relação com a Empresa *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input 
                      type="text" 
                      required
                      value={roleInCompany}
                      onChange={(e) => setRoleInCompany(e.target.value)}
                      placeholder="Ex: Sócio-Proprietário, Gerente Geral, depto. de Marketing"
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Mensagem / Justificativa *</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
                    <textarea 
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Explique por que você está reivindicando esta empresa e forneça quaisquer detalhes adicionais para verificação de propriedade."
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#00897b] focus:bg-white transition-all resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Optional Document Upload Box */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Documento de Comprovação (Opcional)</label>
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                      isDragging 
                        ? 'border-[#00897b] bg-[#00897b]/5' 
                        : selectedFile 
                          ? 'border-emerald-300 bg-emerald-50/35' 
                          : 'border-zinc-200 bg-zinc-50/40 hover:bg-zinc-50 hover:border-zinc-300'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="proofFile"
                      className="hidden" 
                      onChange={handleFileChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                    />
                    <label htmlFor="proofFile" className="cursor-pointer block">
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2 text-emerald-600">
                          <FileText className="w-5 h-5 text-emerald-500" />
                          <span className="text-xs font-bold truncate max-w-xs">{selectedFile.name} (Pronto)</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <UploadCloud className="w-6 h-6 text-zinc-400 mx-auto" />
                          <p className="text-xs font-bold text-zinc-600">Arraste ou clique para anexar um comprovante</p>
                          <p className="text-[10px] text-zinc-400">Ex: Contrato social, CNPJ ou comprovante de endereço. PDF, JPG ou PNG.</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={onClose}
                    className="flex-1 py-3 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-2xl font-black text-xs uppercase tracking-wider transition-all border border-zinc-200 text-center"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-1 py-3 bg-[#00897b] text-white hover:bg-[#00796b] rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/10 text-center flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Enviar Solicitação</span>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
