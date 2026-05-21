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
  Loader2,
  Crown,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import { GroundingChunk } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { InteractionHistory } from './InteractionHistory';
import { RegisterEstablishmentModal } from './RegisterEstablishmentModal';
import { getBusinessStatus } from '../utils/hours';
import { getDirectionsUrl } from '../utils/maps';

interface EstablishmentCardProps {
  chunk: GroundingChunk;
  distance: string;
  userLocation?: { latitude: number; longitude: number };
  isRealLocation?: boolean;
  onRefresh?: () => void;
  defaultOpen?: boolean;
  onCloseDetails?: () => void;
}

type ModalType = 'avaliar' | 'reclamar' | 'indicar' | 'comentar' | null;

export const EstablishmentCard: React.FC<EstablishmentCardProps> = ({ 
  chunk, 
  distance, 
  userLocation, 
  isRealLocation,
  onRefresh,
  defaultOpen = false,
  onCloseDetails
}) => {
  const { user, profile, role, setIsAuthModalOpen } = useAuth();
  const isAdmin = user && (role === 'admin' || user.email === 'alcidinopk@gmail.com');
  const isOwner = user && chunk.maps?.user_id === user.id;
  const [canEdit, setCanEdit] = useState(isAdmin || isOwner);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const handleAction = (action: () => void) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    action();
  };
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFullHoursModal, setShowFullHoursModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullDetailsOpen, setIsFullDetailsOpen] = useState(defaultOpen);

  const rawImages = chunk.maps?.images || [];
  const images = Array.isArray(rawImages) 
    ? rawImages.filter((img: any) => typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:image/')))
    : [];

  const subCategoryStr = chunk.maps?.subCategory || chunk.maps?.sub_category;
  const subCategories = typeof subCategoryStr === 'string' 
    ? (subCategoryStr.includes(' | ') ? subCategoryStr.split(' | ') : subCategoryStr.split(/,\s*(?![^()]*\))/))
    : [];

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
  
  // Obtém a URL de rota corretíssima traçada a partir do link do Google Maps salvo se disponível,
  // ou através das coordenadas cadastradas, integrando a localização de origem do usuário para traçar a rota perfeita.
  const routeUrl = getDirectionsUrl(uri, location?.latitude, location?.longitude, userLocation);
  const shareText = `Confira ${title} no VidaLocal: ${uri}`;

  const statusInfo = getBusinessStatus(chunk.maps?.hours);

  React.useEffect(() => {
    const checkPermission = async () => {
      if (!user || !chunk.maps?.id) return;
      if (isAdmin || isOwner) {
        setCanEdit(true);
        return;
      }

      try {
        const response = await fetch(`/api/establishments/${chunk.maps.id}/can-edit`, {
          headers: { 'x-user-id': user.id }
        });
        if (response.ok) {
          const data = await response.json();
          setCanEdit(!!data.can_edit);
        } else {
          setCanEdit(false);
        }
      } catch (err) {
        setCanEdit(false);
      }
    };
    checkPermission();
  }, [user, chunk.maps, isAdmin, isOwner]);

  const handleDelete = async () => {
    if (!chunk.maps?.id) return;
    if (!confirm(`Tem certeza que deseja excluir "${title}"?`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/establishments/${chunk.maps.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert("Estabelecimento excluído com sucesso!");
        if (onRefresh) onRefresh();
        else window.location.reload();
      } else {
        alert(`Erro ao excluir: ${data.error || "Ocorreu um erro inesperado."}`);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Erro de conexão ao excluir. Verifique sua internet.");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeModal || !chunk.maps?.id) return;

    try {
      const { error } = await supabase.from('interactions').insert([
        {
          establishment_id: chunk.maps.id,
          user_id: user.id,
          user_name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
          type: activeModal,
          content: feedbackText,
          rating: activeModal === 'avaliar' ? rating : null
        }
      ]);

      if (error) throw error;

      setIsSubmitted(true);
      setTimeout(() => {
        setIsSubmitted(false);
        setActiveModal(null);
        setFeedbackText('');
        setRating(0);
      }, 2000);
    } catch (err) {
      console.error('Error submitting interaction:', err);
      alert('Erro ao enviar interação. Verifique se o banco de dados está configurado corretamente.');
    }
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
    comentar: {
      title: 'Enviar Comentário',
      placeholder: 'Escreva seu comentário ou sugestão...',
      icon: <MessageCircle className="w-5 h-5 text-[#25D366]" />,
      buttonClass: 'bg-[#25D366] text-white',
      label: 'Comentário'
    }
  };

  return (
    <>
      <motion.div 
        className="group bg-white border border-zinc-100 rounded-3xl p-0 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-900/10 transition-all overflow-hidden flex flex-col"
      >
        {/* Top Image Section */}
        <div 
          className="relative w-full aspect-video bg-zinc-200 cursor-pointer overflow-hidden group-image"
          onClick={() => setIsFullDetailsOpen(true)}
        >
          {images.length > 0 ? (
            <motion.img
              key={currentImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={images[currentImageIndex]}
              alt={`${title} - Foto ${currentImageIndex + 1}`}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-400 gap-2">
              <Plus className="w-8 h-8 opacity-20" />
              <span className="text-[10px] uppercase tracking-widest font-bold opacity-40">Sem fotos</span>
            </div>
          )}

          {/* Overlays: Badges Top Left */}
          <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
            {chunk.maps?.is_premium && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f57c00] text-white text-[10px] font-bold rounded-xl shadow-lg backdrop-blur-md">
                <Crown className="w-3 h-3" />
                Premium
              </div>
            )}
            {chunk.maps?.is_featured && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563eb] text-white text-[10px] font-bold rounded-xl shadow-lg backdrop-blur-md">
                <Sparkles className="w-3 h-3" />
                Destaque
              </div>
            )}
            {chunk.maps?.is_verified && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] text-white text-[10px] font-bold rounded-xl shadow-lg backdrop-blur-md">
                <CheckCircle2 className="w-3 h-3" />
                Verificado
              </div>
            )}
          </div>

          {/* Quick Info Overlay Bottom */}
          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
          
          <div className="absolute bottom-3 right-3 text-white text-[10px] font-bold bg-black/40 backdrop-blur-md px-2 py-1 rounded-lg">
            Clique para ver detalhes
          </div>

          {/* Action Buttons Overlay */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto">
            <a 
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-all shadow-xl"
              title="Traçar Rota"
            >
              <Navigation2 className="w-3.5 h-3.5" />
            </a>
            <a 
              href={whatsappUrl}
              target={whatsappUrl !== "#" ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                if (whatsappUrl === "#") {
                  e.preventDefault();
                  return;
                }
                if (!user) {
                  e.preventDefault();
                  setIsAuthModalOpen(true);
                }
              }}
              className={`p-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white transition-all shadow-xl ${
                whatsappUrl !== "#" ? "hover:bg-black/40" : "opacity-40 cursor-not-allowed"
              }`}
              title="WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleAction(handleShare);
              }}
              className="p-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-all shadow-xl"
              title="Compartilhar"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev + 1) % images.length);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Info Section */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-zinc-900 text-sm leading-tight group-hover:text-emerald-700 transition-colors max-w-[75%]">
              {title}
            </h3>
            {/* Rating Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#0f172a] text-white rounded-lg shadow-md shrink-0">
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-bold">{chunk.maps?.rating || '5.0'}</span>
            </div>
          </div>

          <p className="text-[10px] text-zinc-400 font-medium -mt-1 line-clamp-1 uppercase tracking-wide">
            {subCategoryStr || 'Estabelecimento Local'}
          </p>

          <div className="flex flex-col gap-1 mt-1">
            {chunk.maps?.address && (
              <div className="flex items-start gap-1 group-address">
                <MapPin className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-tight line-clamp-1">
                  {chunk.maps.address}
                </p>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Navigation2 className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] font-bold text-blue-600 tracking-tight">{distance}</span>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullHoursModal(!showFullHoursModal);
                }}
                className={`flex items-center gap-1 text-[10px] font-bold ${statusInfo.color} hover:opacity-70 transition-opacity`}
              >
                <Clock className="w-2.5 h-2.5" />
                {statusInfo.label}
              </button>
            </div>

            {showFullHoursModal && chunk.maps?.hours && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-1 p-2 bg-zinc-50 rounded-lg border border-zinc-100"
              >
                <p className="text-[9px] text-zinc-500 font-medium whitespace-pre-line leading-relaxed">
                  {chunk.maps.hours}
                </p>
              </motion.div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center gap-2">
            <button 
              onClick={() => setIsFullDetailsOpen(true)}
              className="flex-1 py-2 bg-zinc-50 border border-zinc-100 text-zinc-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-100 transition-all lg:text-[10px]"
            >
              Ver Tudo
            </button>
            <div className="flex items-center gap-1">
              <a 
                href={whatsappUrl} 
                target="_blank"
                className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                title="WhatsApp"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!user) {
                    e.preventDefault();
                    setIsAuthModalOpen(true);
                  }
                }}
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              {canEdit && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditModalOpen(true); }}
                    className="p-2.5 bg-zinc-100 text-zinc-500 rounded-xl hover:bg-zinc-200 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    disabled={isDeleting}
                    className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                    title="Excluir"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <RegisterEstablishmentModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialData={{
          ...chunk.maps,
          phone: chunk.maps?.phone || rawPhone,
          whatsapp: chunk.maps?.whatsapp || rawWhatsapp
        }}
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

      {/* Full Detail Modal (Expanded Card) */}
      <AnimatePresence>
        {isFullDetailsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-white sm:bg-black/80 sm:backdrop-blur-xl flex justify-center overflow-y-auto"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-fit sm:my-8 sm:rounded-[40px] overflow-hidden shadow-2xl"
            >
              {/* Image Header */}
              <div className="relative w-full aspect-square sm:aspect-video bg-zinc-100 flex items-center justify-center overflow-hidden">
                {images.length > 0 ? (
                  <motion.img
                    key={currentImageIndex}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    src={images[currentImageIndex]}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-300 gap-3">
                    <div className="w-20 h-20 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                      <Plus className="w-10 h-10 opacity-20" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] font-black opacity-40">Sem fotos disponíveis</span>
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    setIsFullDetailsOpen(false);
                    if (onCloseDetails) onCloseDetails();
                  }}
                  className="absolute top-4 right-4 p-2.5 bg-black/40 backdrop-blur-md text-white rounded-full hover:bg-black/60 transition-colors z-30"
                >
                  <X className="w-5 h-5" />
                </button>

                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 bg-black/20 backdrop-blur-md rounded-2xl">
                    {images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'}`}
                      />
                    ))}
                  </div>
                )}

                {/* Overlays */}
                <div className="absolute top-4 left-4 flex flex-col gap-1.5 pointer-events-none">
                  {chunk.maps?.is_premium && (
                    <span className="px-3 py-1.5 bg-[#f57c00] text-white rounded-xl text-[9px] font-black shadow-lg flex items-center gap-1.5 backdrop-blur-sm bg-opacity-90">
                      <Crown className="w-3.5 h-3.5" /> PREMIUM
                    </span>
                  )}
                  {chunk.maps?.is_featured && (
                    <span className="px-3 py-1.5 bg-[#2563eb] text-white rounded-xl text-[9px] font-black shadow-lg flex items-center gap-1.5 backdrop-blur-sm bg-opacity-90">
                      <Sparkles className="w-3.5 h-3.5" /> DESTAQUE
                    </span>
                  )}
                  {chunk.maps?.is_verified && (
                    <span className="px-3 py-1.5 bg-[#10b981] text-white rounded-xl text-[9px] font-black shadow-lg flex items-center gap-1.5 backdrop-blur-sm bg-opacity-90">
                      <CheckCircle2 className="w-3.5 h-3.5" /> VERIFICADO
                    </span>
                  )}
                </div>

                {/* Main Action Buttons Overlay (Mobile Optimized) */}
                <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-2 z-10">
                  <a 
                    href={routeUrl} 
                    target="_blank"
                    className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-transform active:scale-95 shadow-xl"
                    title="Rota"
                  >
                    <Navigation2 className="w-5 h-5" />
                  </a>
                  <a 
                    href={whatsappUrl} 
                    target="_blank"
                    className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-transform active:scale-95 shadow-xl"
                    title="WhatsApp"
                    onClick={(e) => {
                      if (!user) {
                        e.preventDefault();
                        setIsAuthModalOpen(true);
                      }
                    }}
                  >
                    <MessageCircle className="w-5 h-5" />
                  </a>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAction(handleShare); }}
                    className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-transform active:scale-95 shadow-xl"
                    title="Compartilhar"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <a 
                    href={telUrl}
                    className="flex-1 flex items-center justify-center p-2.5 bg-black/20 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-black/40 transition-transform active:scale-95 shadow-xl"
                    title="Ligar"
                    onClick={(e) => {
                      if (!user) {
                        e.preventDefault();
                        setIsAuthModalOpen(true);
                      }
                    }}
                  >
                    <Phone className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/* Main Content */}
              <div className="p-5 sm:p-10">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex-1">
                    <h2 className="text-base sm:text-xl lg:text-2xl font-black text-zinc-900 leading-tight tracking-tighter">
                      {title}
                    </h2>
                    <p className="text-[10px] sm:text-sm font-bold text-zinc-400 mt-0.5 uppercase tracking-wide">
                      {subCategoryStr}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a] text-white rounded-xl shadow-lg shrink-0">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm sm:text-lg font-black tracking-tighter">{chunk.maps?.rating || '5.0'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-4 sm:mt-12">
                  <div className="space-y-6 sm:space-y-8">
                    {/* Location */}
                    <div className="flex gap-4 sm:gap-6">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center text-blue-600">
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Localização</h4>
                        <p className="text-xs sm:text-sm font-bold text-zinc-800 leading-relaxed truncate sm:whitespace-normal">{chunk.maps?.address}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-blue-600 font-black text-[10px] sm:text-sm">
                          <Navigation2 className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                          {distance} de você
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex gap-4 sm:gap-6">
                      <div 
                        onClick={() => setShowFullHoursModal(!showFullHoursModal)}
                        className={`w-10 h-10 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center ${statusInfo.color.replace('text-', 'bg-')} text-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity`}
                      >
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h4 className="text-[10px] sm:text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Horário</h4>
                        <button 
                          onClick={() => setShowFullHoursModal(!showFullHoursModal)}
                          className={`text-xs sm:text-sm font-black ${statusInfo.color} flex items-center gap-2 hover:opacity-70 transition-opacity`}
                        >
                          {statusInfo.label}
                          <ChevronDown className={`w-4 h-4 transition-transform ${showFullHoursModal ? 'rotate-180' : ''}`} />
                        </button>
                        {showFullHoursModal && chunk.maps?.hours && (
                          <motion.p 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-[10px] sm:text-xs text-zinc-500 font-medium mt-2 leading-relaxed whitespace-pre-line"
                          >
                            {chunk.maps.hours}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Description */}
                    {chunk.maps?.description && (
                      <div className="p-5 sm:p-8 bg-zinc-50 rounded-[28px] sm:rounded-[32px] border border-zinc-100">
                        <h4 className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">Sobre</h4>
                        <p className="text-xs sm:text-sm text-zinc-600 font-medium leading-relaxed italic">
                          "{chunk.maps.description}"
                        </p>
                      </div>
                    )}

                    {/* Actions (Desktop Only) */}
                    <div className="hidden sm:flex flex-col gap-2.5">
                      <a 
                        href={routeUrl} 
                        target="_blank"
                        className="flex items-center justify-center gap-2.5 w-full py-4 bg-[#f57c00] text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-900/10 hover:scale-[1.01] transition-all"
                        onClick={(e) => {
                          if (!user) {
                            e.preventDefault();
                            setIsAuthModalOpen(true);
                          }
                        }}
                      >
                        <Navigation2 className="w-4 h-4 fill-white" /> Traçar Rota
                      </a>
                      <div className="grid grid-cols-2 gap-2.5">
                        <a 
                          href={whatsappUrl} 
                          target="_blank"
                          className="flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:scale-[1.01] transition-all"
                          onClick={(e) => {
                            if (!user) {
                              e.preventDefault();
                              setIsAuthModalOpen(true);
                            }
                          }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                        <a 
                          href={telUrl}
                          className="flex items-center justify-center gap-2 py-3.5 bg-zinc-900 text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:scale-[1.01] transition-all"
                          onClick={(e) => {
                            if (!user) {
                              e.preventDefault();
                              setIsAuthModalOpen(true);
                            }
                          }}
                        >
                          <Phone className="w-3.5 h-3.5" /> Ligar
                        </a>
                      </div>

                      {canEdit && (
                        <div className="grid grid-cols-2 gap-2.5 mt-2">
                          <button 
                            onClick={() => setIsEditModalOpen(true)}
                            className="flex items-center justify-center gap-2 py-3 bg-zinc-100 text-zinc-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-all"
                          >
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button 
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                          >
                            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Interaction History Section */}
                <div className="mt-8 pt-8 border-t border-zinc-100">
                  <InteractionHistory establishmentId={chunk.maps?.id || ''} />
                </div>

                {/* Feedback Section (Mobile optimized - Single Row) */}
                <div className="mt-4 sm:mt-12 pt-4 sm:pt-12 border-t border-zinc-100 flex items-center justify-between gap-0.5 overflow-x-hidden">
                  <button onClick={() => handleAction(() => { setIsFullDetailsOpen(false); setActiveModal('avaliar'); })} className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-yellow-500 group-hover:border-yellow-200 transition-all">
                      <Star className="w-4 h-4" />
                    </div>
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Avaliar</span>
                  </button>
                  <button onClick={() => handleAction(() => { setIsFullDetailsOpen(false); setActiveModal('reclamar'); })} className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-red-500 group-hover:border-red-200 transition-all">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Reclamar</span>
                  </button>
                  <button onClick={() => handleAction(() => { setIsFullDetailsOpen(false); setActiveModal('comentar'); })} className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-all">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Comentar</span>
                  </button>
                  <button onClick={() => handleAction(() => { setIsFullDetailsOpen(false); setActiveModal('indicar'); })} className="flex-1 flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-50 transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 group-hover:border-emerald-200 transition-all">
                      <ThumbsUp className="w-4 h-4" />
                    </div>
                    <span className="text-[7px] font-black text-zinc-400 uppercase tracking-widest">Indicar</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
