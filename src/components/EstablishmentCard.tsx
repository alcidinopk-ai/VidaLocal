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
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GroundingChunk } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';

interface EstablishmentCardProps {
  chunk: GroundingChunk;
  distance: string;
  isRealLocation?: boolean;
}

type ModalType = 'avaliar' | 'reclamar' | 'indicar' | null;

export const EstablishmentCard: React.FC<EstablishmentCardProps> = ({ chunk, distance, isRealLocation }) => {
  const { user } = useAuth();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const title = chunk.maps?.title || 'Estabelecimento';
  const uri = chunk.maps?.uri || '#';
  const location = chunk.maps?.location;
  
  // Mock phone for demo if not provided (Gemini grounding usually doesn't provide phone directly in the chunk)
  const phone = "(63) 99999-9999"; 
  const whatsappUrl = `https://wa.me/55${phone.replace(/\D/g, '')}`;
  const telUrl = `tel:${phone.replace(/\D/g, '')}`;
  const routeUrl = location 
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
    : uri;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`Feedback for ${title} by ${user?.name}:`, { type: activeModal, text: feedbackText, rating });
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
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-zinc-900 text-sm group-hover:text-emerald-700 transition-colors">{title}</h3>
              </div>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                {location && isRealLocation 
                  ? `Localizado a ${distance} de sua posição atual.` 
                  : `Localizado em sua cidade. A aproximadamente ${distance} de você.`}
              </p>
            </div>
          </div>
          <a 
            href={uri} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-white border border-zinc-100 text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Feedback Buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button 
            onClick={() => setActiveModal('avaliar')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-all"
          >
            <Star className="w-3.5 h-3.5" />
            Avaliar
          </button>
          <button 
            onClick={() => setActiveModal('reclamar')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-600 text-xs font-bold hover:bg-zinc-50 transition-all"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Reclamar
          </button>
          <button 
            onClick={() => setActiveModal('indicar')}
            className="p-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-400 hover:text-emerald-600 hover:border-emerald-200 transition-all"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

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
