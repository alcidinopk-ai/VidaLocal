import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Star, MessageCircle, AlertTriangle, ThumbsUp, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Interaction {
  id: string;
  user_name: string;
  type: 'avaliar' | 'reclamar' | 'indicar' | 'comentar';
  content: string;
  rating?: number;
  created_at: string;
}

interface InteractionHistoryProps {
  establishmentId: string;
}

export const InteractionHistory: React.FC<InteractionHistoryProps> = ({ establishmentId }) => {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInteractions = async () => {
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (err) {
      console.error('Error fetching interactions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInteractions();

    // Set up real-time subscription
    const channel = supabase
      .channel(`interactions-${establishmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'interactions',
          filter: `establishment_id=eq.${establishmentId}`
        },
        (payload) => {
          setInteractions((prev) => [payload.new as Interaction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'avaliar': return <Star className="w-4 h-4 text-yellow-500" />;
      case 'reclamar': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'indicar': return <ThumbsUp className="w-4 h-4 text-emerald-500" />;
      case 'comentar': return <MessageCircle className="w-4 h-4 text-blue-500" />;
      default: return <MessageCircle className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getLabel = (type: string) => {
    switch (type) {
      case 'avaliar': return 'Avaliação';
      case 'reclamar': return 'Reclamação';
      case 'indicar': return 'Indicação';
      case 'comentar': return 'Comentário';
      default: return 'Ação';
    }
  };

  if (isLoading) {
    return (
      <div className="py-8 flex flex-col items-center justify-center text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-xs font-medium uppercase tracking-widest">Carregando histórico...</span>
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-3 bg-zinc-50 rounded-[32px] border border-dashed border-zinc-200">
        <MessageCircle className="w-8 h-8 opacity-20" />
        <p className="text-xs font-bold uppercase tracking-widest opacity-40 text-center px-6">
          Ainda não há interações para este local.<br/>Seja o primeiro a participar!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest">Histórico de Ações</h4>
        <div className="px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full text-[9px] font-bold">
          {interactions.length} {interactions.length === 1 ? 'interação' : 'interações'}
        </div>
      </div>
      
      <div className="space-y-3">
        {interactions.map((interaction) => (
          <div 
            key={interaction.id} 
            className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white border border-zinc-100 flex items-center justify-center">
                  {getIcon(interaction.type)}
                </div>
                <div>
                  <h5 className="text-xs font-bold text-zinc-900 line-clamp-1">{interaction.user_name || 'Anônimo'}</h5>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">
                    {getLabel(interaction.type)} • {formatDistanceToNow(new Date(interaction.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
              {interaction.type === 'avaliar' && interaction.rating && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-50 text-yellow-600 rounded-lg border border-yellow-100">
                  <Star className="w-2.5 h-2.5 fill-yellow-500" />
                  <span className="text-[10px] font-bold">{interaction.rating}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed pl-10">
              {interaction.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
