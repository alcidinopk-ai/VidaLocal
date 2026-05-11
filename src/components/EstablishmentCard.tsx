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
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight
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
  const isAdmin = user && role === 'admin';
  const isOwner = user && chunk.maps?.user_id === user.id;
  const [canEdit, setCanEdit] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFullHours, setShowFullHours] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const images = chunk.maps?.images || [];

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
  const routeUrl = location 
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}${userLocation ? `&origin=${userLocation.latitude},${userLocation.longitude}` : ''}`
    : uri;
  const shareText = `Confira ${title} no VidaLocal: ${uri}`;

  const statusInfo = getBusinessStatus(chunk.maps?.hours);

  React.useEffect(() => {
    const checkPermission = async () => {
      if (!user || !chunk.maps?.id) return;
      if (isAdmin || isOwner) {
        setCanEdit(true);
        return;
      }

      // If not owner/admin, check permissions table via API
      try {
        const response = await fetch(`/api/search?id=${chunk.maps.id}`, {
          headers: { 'x-user-id': user.id }
        });
        // The search endpoint with x-user-id could potentially return permission info
        // For now, if current location is editable by user, it should work.
        // A better way is a dedicated check endpoint or including it in initial fetch.
        // But since we already have canUserEdit on server for PUT/DELETE,
        // we'll try a lightweight check.
        if (chunk.maps.short_id) {
          const permRes = await fetch(`/api/admin/permissions/${chunk.maps.short_id}`, {
            headers: { 'x-user-id': user.id }
          });
          if (permRes.ok) setCanEdit(true);
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
        className="group bg-zinc-50 border border-zinc-100 rounded-2xl p-5 hover:bg-white hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all overflow-hidden"
      >
        {/* Image Gallery */}
        {images.length > 0 ? (
          <div 
            className="relative w-full aspect-video mb-5 rounded-xl overflow-hidden bg-zinc-200 group-image cursor-zoom-in"
            onClick={() => setIsLightboxOpen(true)}
          >
            <motion.img
              key={currentImageIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={images[currentImageIndex]}
              alt={`${title} - Foto ${currentImageIndex + 1}`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-lg text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity">
              Clique para ampliar
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex((prev) => (prev + 1) % images.length);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentImageIndex ? "bg-white w-3" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="relative w-full aspect-video mb-5 rounded-xl overflow-hidden bg-zinc-100 flex items-center justify-center border border-dashed border-zinc-200 group-hover:border-emerald-200 transition-all">
            <div className="flex flex-col items-center gap-2 text-zinc-400 group-hover:text-emerald-500 transition-colors">
              <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
              </div>
              <span className="text-[10px] font-medium uppercase tracking-widest">Sem foto disponível</span>
            </div>
          </div>
        )}

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
                <h3 className="font-bold text-zinc-900 text-sm group-hover:text-emerald-700 transition-colors uppercase tracking-tight">{title}</h3>
                {subCategories.map((cat, idx) => {
                  return (
                    <span key={idx} className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {cat.trim()}
                    </span>
                  );
                })}
                {chunk.maps?.short_id && (
                  <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded" title="ID de Identificação">
                    #{chunk.maps.short_id}
                  </span>
                )}
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
                {chunk.maps?.is_open_24_hours && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full shadow-sm">
                    <Clock className="w-2.5 h-2.5" />
                    24 Horas
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
                  <button 
                    onClick={() => setShowFullHours(!showFullHours)}
                    className={`flex items-center gap-1 text-[10px] font-bold hover:opacity-80 transition-opacity outline-none ${statusInfo.color}`}
                  >
                    <Clock className="w-2.5 h-2.5" />
                    {statusInfo.label}
                    {chunk.maps?.hours && (
                      <ChevronDown className={`w-2 h-2 transition-transform ${showFullHours ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  <AnimatePresence>
                    {showFullHours && chunk.maps?.hours && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="text-[9px] text-zinc-500 font-medium whitespace-pre-line mt-1 bg-zinc-100/50 p-2 rounded-lg border border-zinc-100">
                          {chunk.maps.hours}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                {location && isRealLocation 
                  ? `Localizado a ${distance} de sua posição atual.` 
                  : `Localizado em sua cidade. A aproximadamente ${distance} de você.`}
              </p>
              {chunk.maps?.address && (
                <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  {chunk.maps.address}
                </p>
              )}
              {chunk.maps?.description && (
                <p className="text-xs text-zinc-600 mt-2 italic leading-relaxed border-l-2 border-emerald-100 pl-3">
                  {chunk.maps.description}
                </p>
              )}
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
          {(isAdmin || canEdit) && (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-[#00897b] hover:bg-emerald-100 transition-all"
                title={chunk.maps?.id ? "Editar" : "Cadastrar no VidaLocal"}
              >
                {chunk.maps?.id ? <Edit className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
                    {chunk.maps?.id && (
                      <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50"
                        title="Excluir"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
            </div>
          )}
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

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && images.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 flex-col gap-6"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button 
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>

            <div 
              className="relative w-full max-w-5xl aspect-video sm:aspect-[16/9] bg-black rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.img
                key={currentImageIndex}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                src={images[currentImageIndex]}
                alt={`${title} - Foto ${currentImageIndex + 1}`}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />

              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors border border-white/10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors border border-white/10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-white font-bold text-lg uppercase tracking-widest">{title}</p>
              <div className="flex gap-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-12 h-1.5 rounded-full transition-all ${
                      idx === currentImageIndex ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
              <p className="text-zinc-500 text-xs font-medium mt-2">
                FOTO {currentImageIndex + 1} DE {images.length}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
