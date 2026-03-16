import React, { useState, useEffect } from 'react';
import { suggestBusinessHours } from '../services/geminiService';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface Establishment {
  id: string;
  name: string;
  address: string;
  city_id: number;
  hours?: string;
}

export const MaintenanceTools: React.FC = () => {
  const [missingHours, setMissingHours] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [results, setResults] = useState<{ id: string; status: 'success' | 'error' | 'pending'; message?: string }[]>([]);
  const [cityName, setCityName] = useState<string>('');

  const fetchMissing = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/establishments/missing-hours');
      const data = await res.json();
      setMissingHours(data);
      setResults(data.map((e: Establishment) => ({ id: e.id, status: 'pending' })));
    } catch (err) {
      console.error("Error fetching missing hours:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMissing();
  }, []);

  const updateHours = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    for (const est of missingHours) {
      try {
        setResults(prev => prev.map(r => r.id === est.id ? { ...r, message: 'Buscando no Maps...' } : r));
        
        // 1. Get hours from Gemini
        const hours = await suggestBusinessHours(est.name, "Gurupi", est.address);
        
        if (hours) {
          setResults(prev => prev.map(r => r.id === est.id ? { ...r, message: 'Atualizando banco...' } : r));
          
          // 2. Update Supabase
          const res = await fetch(`/api/establishments/${est.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours })
          });

          if (res.ok) {
            setResults(prev => prev.map(r => r.id === est.id ? { ...r, status: 'success', message: hours } : r));
          } else {
            setResults(prev => prev.map(r => r.id === est.id ? { ...r, status: 'error', message: 'Erro ao salvar' } : r));
          }
        } else {
          setResults(prev => prev.map(r => r.id === est.id ? { ...r, status: 'error', message: 'Não encontrado' } : r));
        }
      } catch (err) {
        console.error(`Error updating ${est.name}:`, err);
        setResults(prev => prev.map(r => r.id === est.id ? { ...r, status: 'error', message: 'Erro fatal' } : r));
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsUpdating(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-zinc-100 overflow-hidden">
      <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#f57c00]" />
            Manutenção de Horários
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Atualiza estabelecimentos com "Horário não informado" usando Google Maps.
          </p>
        </div>
        <button 
          onClick={fetchMissing}
          disabled={isLoading || isUpdating}
          className="p-2 rounded-xl hover:bg-zinc-200 transition-colors"
          title="Recarregar lista"
        >
          <RefreshCw className={`w-5 h-5 text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#f57c00] animate-spin mb-4" />
            <p className="text-sm text-zinc-500">Buscando estabelecimentos...</p>
          </div>
        ) : missingHours.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
            <p className="text-zinc-500 font-medium">Todos os horários estão preenchidos!</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-zinc-600">
                {missingHours.length} estabelecimentos pendentes
              </span>
              <button 
                onClick={updateHours}
                disabled={isUpdating}
                className="px-6 py-2 bg-[#f57c00] text-white text-sm font-bold rounded-xl hover:bg-[#e65100] transition-all shadow-lg disabled:opacity-50"
              >
                {isUpdating ? 'Processando...' : 'Iniciar Atualização em Lote'}
              </button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {missingHours.map((est) => {
                const result = results.find(r => r.id === est.id);
                return (
                  <div key={est.id} className="p-3 rounded-2xl border border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-zinc-800 truncate">{est.name}</h3>
                      <p className="text-[10px] text-zinc-500 truncate">{est.address}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result?.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {result?.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {result?.status === 'pending' && result.message && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                      <span className={`text-[10px] font-bold ${
                        result?.status === 'success' ? 'text-emerald-600' : 
                        result?.status === 'error' ? 'text-red-600' : 'text-zinc-400'
                      }`}>
                        {result?.message || 'Pendente'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
