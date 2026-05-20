import React, { useState, useEffect } from 'react';
import { suggestBusinessHours } from '../services/geminiService';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, Clock, MapPin, Globe, Search, Compass, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Establishment {
  id: string;
  name: string;
  address: string;
  city_id: number;
  hours?: string;
}

interface AutoEstablishment {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  cityName: string;
  cityUf: string;
  isHighPrecision: boolean;
  statusText?: string;
  isProcessing?: boolean;
}

export const MaintenanceTools: React.FC = () => {
  const { user } = useAuth();
  const [missingHours, setMissingHours] = useState<Establishment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoStats, setGeoStats] = useState({ total: 0, processed: 0, errors: 0 });
  const [results, setResults] = useState<{ id: string; status: 'success' | 'error' | 'pending'; message?: string }[]>([]);

  // Precision Geocoding states
  const [autoEsts, setAutoEsts] = useState<AutoEstablishment[]>([]);
  const [isLoadingAutoEsts, setIsLoadingAutoEsts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchCorrecting, setIsBatchCorrecting] = useState(false);
  const [batchStats, setBatchStats] = useState({ totalNeeded: 0, corrected: 0 });

  const runGeoBackfill = async () => {
    if (isGeocoding || !user) return;
    setIsGeocoding(true);
    setGeoStats({ total: 0, processed: 0, errors: 0 });

    try {
      const res = await fetch('/api/maintenance/backfill-geo', {
        method: 'POST',
        headers: { 'x-user-id': user.id }
      });
      const data = await res.json();
      setGeoStats({ 
        total: data.batchSize || 0, 
        processed: data.processed || 0, 
        errors: data.errors || 0 
      });
      
      if (data.processed > 0) {
        alert(`${data.processed} estabelecimentos foram geocodificados com sucesso!`);
      } else if (data.batchSize === 0) {
        alert("Todos os estabelecimentos já possuem cidade e estado vinculados.");
      }
    } catch (err) {
      console.error("Geo backfill error:", err);
      alert("Erro ao executar geocodificação.");
    } finally {
      setIsGeocoding(false);
    }
  };

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

  const fetchAutoEsts = async () => {
    if (!user) return;
    setIsLoadingAutoEsts(true);
    try {
      const res = await fetch('/api/admin/auto-establishments', {
        headers: { 'x-user-id': user.id }
      });
      if (res.ok) {
        const data = await res.json();
        setAutoEsts(data);
      }
    } catch (err) {
      console.error("Error fetching auto establishments:", err);
    } finally {
      setIsLoadingAutoEsts(false);
    }
  };

  const correctCoordinates = async (id: string) => {
    if (!user) return;
    
    setAutoEsts(prev => prev.map(item => item.id === id ? { ...item, isProcessing: true, statusText: 'Buscando...' } : item));

    try {
      const res = await fetch('/api/admin/correct-coordinates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify({ establishmentId: id })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAutoEsts(prev => prev.map(item => item.id === id ? { 
          ...item, 
          latitude: data.latitude, 
          longitude: data.longitude, 
          isHighPrecision: true,
          isProcessing: false,
          statusText: 'Sucesso' 
        } : item));
        return true;
      } else {
        setAutoEsts(prev => prev.map(item => item.id === id ? { 
          ...item, 
          isProcessing: false, 
          statusText: data.error || 'Falha' 
        } : item));
        return false;
      }
    } catch (err) {
      console.error("Error correcting coordinates:", err);
      setAutoEsts(prev => prev.map(item => item.id === id ? { 
        ...item, 
        isProcessing: false, 
        statusText: 'Erro de rede' 
      } : item));
      return false;
    }
  };

  const runBatchCorrection = async () => {
    if (isBatchCorrecting || !user) return;
    
    const pendingItems = autoEsts.filter(item => !item.isHighPrecision);
    if (pendingItems.length === 0) {
      alert("Todos os estabelecimentos já estão corrigidos com coordenadas de alta precisão!");
      return;
    }

    setIsBatchCorrecting(true);
    const batchSize = Math.min(pendingItems.length, 5);
    setBatchStats({ totalNeeded: batchSize, corrected: 0 });

    for (let i = 0; i < batchSize; i++) {
      const target = pendingItems[i];
      const success = await correctCoordinates(target.id);
      if (success) {
        setBatchStats(prev => ({ ...prev, corrected: prev.corrected + 1 }));
      }
      if (i < batchSize - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setIsBatchCorrecting(false);
  };

  useEffect(() => {
    fetchMissing();
    fetchAutoEsts();
  }, [user]);

  const updateHours = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    for (const est of missingHours) {
      try {
        setResults(prev => prev.map(r => r.id === est.id ? { ...r, message: 'Buscando no Maps...' } : r));
        
        // 1. Get hours from Gemini
        const result = await suggestBusinessHours(est.name, "Gurupi", est.address);
        
        if (result) {
          const hours = result.summary;
          setResults(prev => prev.map(r => r.id === est.id ? { ...r, message: 'Atualizando banco...' } : r));
          
          // 2. Update Supabase
          const res = await fetch(`/api/establishments/${est.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              hours,
              is_open_24_hours: result.is24h,
              openingHours: result.structured?.flatMap(h => 
                h.closed 
                  ? [{ day_of_week: h.day, open_time: null, close_time: null, is_closed: true }]
                  : h.slots.map(slot => ({
                      day_of_week: h.day,
                      open_time: slot.open,
                      close_time: slot.close,
                      is_closed: false
                    }))
              )
            })
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

      {/* SEÇÃO 2: CORREÇÃO DE COORDENADAS REAIS VIA GOOGLE MAPS */}
      <div className="mt-8 bg-white rounded-3xl shadow-xl border border-zinc-100 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#00897b]" />
              Correção de Coordenadas (Google Maps Grounding)
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Varre o banco de dados e usa o Gemini + Google Search para obter a geolocalização precisa (Real-world GPS) dos estabelecimentos integrados por nome comercial.
            </p>
          </div>
          <button 
            onClick={fetchAutoEsts}
            disabled={isLoadingAutoEsts || isBatchCorrecting}
            className="p-2 rounded-xl hover:bg-zinc-200 transition-colors"
            title="Recarregar lista"
          >
            <RefreshCw className={`w-5 h-5 text-zinc-400 ${isLoadingAutoEsts ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-6">
          {isLoadingAutoEsts ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#00897b] animate-spin mb-4" />
              <p className="text-sm text-zinc-500">Mapeando estabelecimentos sob risco de coordenada padrão...</p>
            </div>
          ) : autoEsts.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-[#00897b] mx-auto mb-4 opacity-20" />
              <p className="text-zinc-500 font-medium font-bold">Todos os estabelecimentos usam coordenadas limpas!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar estabelecimento por nome nos cards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00897b]"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={runBatchCorrection}
                    disabled={isBatchCorrecting}
                    className="px-5 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                  >
                    {isBatchCorrecting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Corrigindo Lote ({batchStats.corrected}/{batchStats.totalNeeded})...
                      </>
                    ) : (
                      <>
                        <Compass className="w-3.5 h-3.5" />
                        Corrigir Lote (Próximos 5)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status stats container */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-xs">
                <div>
                  <span className="text-zinc-500 block">Total de Cadastros Auto:</span>
                  <strong className="text-zinc-800 font-bold block text-sm mt-0.5">{autoEsts.length}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 block">Alta Precisão (Confirmados):</span>
                  <strong className="text-emerald-600 font-bold block text-sm mt-0.5">
                    {autoEsts.filter(e => e.isHighPrecision).length} ({Math.round((autoEsts.filter(e => e.isHighPrecision).length / autoEsts.length) * 100)}%)
                  </strong>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <span className="text-zinc-500 block">Coordenadas Genéricas/Restantes:</span>
                  <strong className="text-[#f57c00] font-bold block text-sm mt-0.5">
                    {autoEsts.filter(e => !e.isHighPrecision).length}
                  </strong>
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {autoEsts
                  .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((est) => {
                    return (
                      <div key={est.id} className="p-3.5 rounded-2xl border border-zinc-100 bg-white hover:border-zinc-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-800 truncate">{est.name}</span>
                            {est.isHighPrecision ? (
                              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 whitespace-nowrap">
                                <Check className="w-2.5 h-2.5" />
                                Coordenada Real
                              </span>
                            ) : (
                              <span className="bg-[#fff3e0] text-[#e65100] text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 whitespace-nowrap">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Ponto Fixo/Repetido
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">{est.address || 'Sem endereço textual'}</p>
                          <p className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-zinc-400" />
                            Lat: {Number(est.latitude).toFixed(6)}, Lng: {Number(est.longitude).toFixed(6)}
                          </p>

                          {est.statusText && est.statusText !== 'Sucesso' && est.statusText !== 'Buscando...' && (
                            <div className="mt-2 text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5 flex items-start gap-2 break-all sm:break-normal">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              <span className="leading-relaxed font-medium">{est.statusText}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 sm:self-center">
                          {est.statusText === 'Buscando...' && (
                            <span className="text-[10px] font-bold text-blue-500 animate-pulse whitespace-nowrap mr-1">
                              Buscando...
                            </span>
                          )}
                          {est.statusText === 'Sucesso' && (
                            <span className="text-[10px] font-bold text-emerald-600 whitespace-nowrap mr-1 flex items-center gap-0.5">
                              <Check className="w-3.5 h-3.5" />
                              Sucesso!
                            </span>
                          )}
                          <button 
                            onClick={() => correctCoordinates(est.id)}
                            disabled={est.isProcessing || isBatchCorrecting}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                              est.isHighPrecision
                                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                                : 'bg-[#00897b] hover:bg-[#00695c] text-white shadow-sm'
                            }`}
                          >
                            {est.isProcessing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Buscando...
                              </>
                            ) : est.isHighPrecision ? (
                              <>
                                <Compass className="w-3 h-3" />
                                Recorrigir
                              </>
                            ) : (
                              <>
                                <Compass className="w-3 h-3 animate-pulse" />
                                Corrigir GPS
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-zinc-900 rounded-3xl shadow-xl overflow-hidden border border-zinc-800">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/50">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              Geocodificação Reversa (Nominatim)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Resolve automaticamente Cidade e Estado para registros antigos sem vínculo.
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <ul className="text-xs text-zinc-400 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Trava de Segurança: Não sobrescreve dados manuais preenchidos.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Idempotência: Verifica nomes e UFs antes de criar novos registros.
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-emerald-500" />
                  Cortesia: Respeita o limite de 1req/seg da API Nominatim.
                </li>
              </ul>
            </div>
            
            <div className="shrink-0 flex flex-col items-center gap-3">
              <button 
                onClick={runGeoBackfill}
                disabled={isGeocoding}
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando Lote...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Executar Backfill de Geo
                  </>
                )}
              </button>
              
              {geoStats.total > 0 && (
                <div className="text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    Lote Processado: {geoStats.processed} de {geoStats.total}
                  </p>
                  {geoStats.errors > 0 && (
                    <p className="text-[9px] text-red-400 mt-1">Erros: {geoStats.errors}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
