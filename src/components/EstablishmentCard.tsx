import React, { useState } from 'react';
import { 
  MapPin, 
  Phone, 
  MessageCircle, 
  Navigation2, 
  Star, 
  AlertTriangle, 
  ThumbsUp, 
  ExternalLink,
  X,
  CheckCircle2,
  Share2,
  Printer,
  Edit,
  Trash2,
  Crown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import { GroundingChunk } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { RegisterEstablishmentModal } from './RegisterEstablishmentModal';
import { getBusinessStatus } from '../utils/hours';

interface EstablishmentCardProps {
  chunk: GroundingChunk;
  distance: string;
  userLocation?: { latitude: number; longitude: number };
  isRealLocation?: boolean;
  onRefresh?: () => void;
}

type ModalType = 'avaliar' | 'reclamar' | 'indicar' | 'corrigir' | null;

export const EstablishmentCard: React.FC<EstablishmentCardProps> = ({ 
  chunk, 
  distance, 
  userLocation, 
  isRealLocation,
  onRefresh
}) => {
  const { user, role } = useAuth();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const title = chunk.maps?.title || 'Estabelecimento';
  const uri = chunk.maps?.uri || '#';
  const location = chunk.maps?.location;
  
  // Use phone from chunk if available, otherwise fallback
  const rawPhone = chunk.maps?.phone || chunk.maps?.whatsapp;
  const phone = rawPhone || "(63) 3312-0000"; 
  
  const rawWhatsapp = chunk.maps?.whatsapp || chunk.maps?.phone;
  const whatsappNumber = rawWhatsapp ? rawWhatsapp.replace(/\D/g, '') : "";
  
  // Ensure we have the 55 prefix only if not already present
  const formattedWhatsapp = whatsappNumber 
    ? (whatsappNumber.startsWith('55') ? whatsappNumber : `55${whatsappNumber}`)
    : "";
    
  const whatsappUrl = formattedWhatsapp ? `https://wa.me/${formattedWhatsapp}` : "#";
  const telUrl = rawPhone ? `tel:${rawPhone.replace(/\D/g, '')}` : "#";
  const routeUrl = location 
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}${userLocation ? `&origin=${userLocation.latitude},${userLocation.longitude}` : ''}`
    : uri;
  const shareText = `Confira ${title} no VidaLocal: ${uri}`;

  const statusInfo = getBusinessStatus(chunk.maps?.hours);

  const isAdmin = user && role === 'admin';

  const handleDelete = async () => {
    if (!chunk.maps?.id) return;
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/establishments/${chunk.maps.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert("Estabelecimento excluído com sucesso!");
        if (onRefresh) onRefresh();
        else window.location.reload();
      }
 else {
        alert("Erro ao excluir estabelecimento.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erro de conexão ao excluir.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: `Encontrei este lugar no VidaLocal: ${title}`,
          url: uri,
        });
      } catch (err) {
        console.error('Erro ao compartilhar:', err);
      }
    } else {
      // Fallback to WhatsApp
      const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappShareUrl, '_blank');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`Feedback for ${title} by ${user?.email}:`, { type: activeModal, text: feedbackText, rating });
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setActiveModal(null);
      setFeedbackText('');
      setRating(0);
    }, 2000);
  };

  const modalConfig = {
    avaliar: {
      title: `Avaliar ${title}`,
      placeholder: 'Conte sua experiência...',
      icon: <Star className="w-5 h-5 text-yellow-500" />,
      buttonClass: 'bg-zinc-900 text-white',
      label: 'Avaliação'
    },
    reclamar: {
      title: 'Registrar Reclamação',
      placeholder: 'descreva a reclamação',
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      buttonClass: 'bg-white border border-zinc-200 text-zinc-900',
      label: 'Reclamação'
    },
    indicar: {
      title: 'Indicar Estabelecimento',
      placeholder: 'porque você indica este estabelecimento?',
      icon: <ThumbsUp className="w-5 h-5 text-emerald-500" />,
      buttonClass: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      label: 'Indicação'
    },
    corrigir: {
      title: 'Sugerir Correção de Contato',
      placeholder: 'Informe o telefone ou WhatsApp correto...',
      icon: <MessageCircle className="w-5 h-5 text-[#25D366]" />,
      buttonClass: 'bg-[#25D366] text-white',
      label: 'Correção'
    }
  };

  return (
    <>
      <motion.div 
        className="group bg-zinc-50 border border-zinc-100 rounded-2xl p-5 hover:bg-white hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:border-emerald-100 transition-colors relative">
              <MapPin className="w-5 h-5" />
              <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-bold rounded-full shadow-sm">
                {distance}
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-zinc-900 text-sm group-hover:text-emerald-700 transition-colors">{title}</h3>
                {chunk.maps?.is_premium && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-[9px] font-bold rounded-full shadow-sm">
                    <Crown className="w-2.5 h-2.5" />
                    Premium
                  </div>
                )}
                {chunk.maps?.is_verified && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full shadow-sm">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    Verificado
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {rawPhone && (
                  <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" />
                    {rawPhone}
                  </p>
                )}
                <div className="flex flex-col gap-0.5">
                  <div className={`flex items-center gap-1 text-[10px] font-bold ${statusInfo.color}`}>
                    <Clock className="w-2.5 h-2.5" />
                    {statusInfo.label}
                  </div>
                  {chunk.maps?.hours && (
                    <p className="text-[9px] text-zinc-500 font-medium">
                      {chunk.maps.hours}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                {location && isRealLocation 
                  ? `Localizado a ${distance} de sua posição atual.` 
                  : `Localizado em sua cidade. A aproximadamente ${distance} de você.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-white border border-zinc-100 text-zinc-400 hover:text-[#f57c00] hover:border-orange-200 transition-all shadow-sm"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <a 
              href={uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2.5 rounded-xl bg-white border border-zinc-100 text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
              title="Ver no Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Feedback Buttons */}
        <div className="flex flex-col gap-2 mt-4 no-print">
          <div className="flex items-center gap-2">
            <a 
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#f57c00] text-white text-xs font-bold hover:bg-[#e65100] transition-all shadow-lg shadow-orange-900/10"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              Traçar Rota
            </a>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href={whatsappUrl}
              target={whatsappUrl !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={(e) => whatsappUrl === "#" && e.preventDefault()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm ${
                whatsappUrl !== "#" ? "bg-[#25D366] hover:bg-[#128C7E]" : "bg-zinc-200 cursor-not-allowed"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <a 
              href={telUrl}
              onClick={(e) => telUrl === "#" && e.preventDefault()}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm ${
                telUrl !== "#" ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-200 cursor-not-allowed"
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              Ligar
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 no-print">
          <button 
            onClick={() => setActiveModal('avaliar')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-[10px] font-bold hover:bg-zinc-50 transition-all"
          >
            <Star className="w-3 h-3" />
            Avaliar
          </button>
          <button 
            onClick={() => setActiveModal('reclamar')}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-[10px] font-bold hover:bg-zinc-50 transition-all"
          >
            <AlertTriangle className="w-3 h-3" />
            Reclamar
          </button>
          <button 
            onClick={() => setActiveModal('corrigir')}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-all"
            title="Sugerir Correção"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => setActiveModal('indicar')}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-all"
            title="Indicar"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[#00897b] hover:bg-emerald-100 transition-all"
                title="Editar"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <RegisterEstablishmentModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={chunk.maps}
        onSuccess={() => {
          if (onRefresh) onRefresh();
          else setTimeout(() => window.location.reload(), 2000);
        }}
      />

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-zinc-100 relative">
                <h2 className="text-lg font-bold text-zinc-900 text-center px-8">
                  {modalConfig[activeModal].title}
                </h2>
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="p-6">
                {isSubmitted ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Enviado com sucesso!</h3>
                    <p className="text-sm text-zinc-500 mt-2">Obrigado pela sua contribuição.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {activeModal === 'avaliar' && (
                      <div className="flex justify-center gap-2 py-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className="transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star 
                              className={`w-10 h-10 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-200'}`} 
                            />
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <textarea 
                      autoFocus
                      required
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder={modalConfig[activeModal].placeholder}
                      className="w-full h-32 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-zinc-900/5 transition-all text-sm resize-none"
                    />

                    <button 
                      type="submit"
                      className={`w-full py-4 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-zinc-900/10 ${modalConfig[activeModal].buttonClass}`}
                    >
                      Enviar {modalConfig[activeModal].label}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
