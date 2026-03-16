import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, FileSpreadsheet, Filter, Loader2 } from 'lucide-react';
import { CATEGORIES, SUB_CATEGORIES } from '../constants/taxonomy';

interface City {
  id: number;
  name: string;
  uf?: string;
}

interface State {
  id: number;
  name: string;
  uf: string;
}

export const ExportTools: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [states, setStates] = useState<State[]>([]);
  
  // Filters
  const [categoryId, setCategoryId] = useState<string>('');
  const [subCategory, setSubCategory] = useState<string>('');
  const [cityId, setCityId] = useState<string>('');
  const [stateUf, setStateUf] = useState<string>('');

  useEffect(() => {
    // Fetch cities and states for filters
    fetch('/api/states').then(res => res.json()).then(setStates);
    fetch('/api/cities').then(res => res.json()).then(setCities);
  }, []);

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId);
    if (subCategory) params.append('sub_category', subCategory);
    if (cityId) params.append('city_id', cityId);
    if (stateUf) params.append('state_uf', stateUf);

    const res = await fetch(`/api/admin/establishments/export?${params.toString()}`);
    return await res.json();
  };

  const exportToExcel = async () => {
    setIsExporting(true);
    try {
      const data = await fetchData();
      if (!data || data.length === 0) {
        alert("Nenhum dado encontrado para os filtros selecionados.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data.map((e: any) => ({
        ID: e.id,
        Nome: e.name,
        Categoria: CATEGORIES.find(c => c.id === e.category_id)?.name || e.category_id,
        Tipo: e.sub_category,
        Endereço: e.address,
        Telefone: e.phone || '',
        WhatsApp: e.whatsapp || '',
        Cidade: e.cities?.name || '',
        Estado: e.cities?.states?.uf || '',
        Status: e.status,
        Data_Cadastro: e.created_at
      })));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Estabelecimentos");
      XLSX.writeFile(workbook, `VidaLocal_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erro ao exportar para Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const data = await fetchData();
      if (!data || data.length === 0) {
        alert("Nenhum dado encontrado para os filtros selecionados.");
        return;
      }

      const doc = new jsPDF();
      doc.text("Relatório de Estabelecimentos - VidaLocal", 14, 15);
      
      const tableData = data.map((e: any) => [
        e.name,
        CATEGORIES.find(c => c.id === e.category_id)?.name || e.category_id,
        e.sub_category,
        e.cities?.name || '',
        e.phone || e.whatsapp || ''
      ]);

      (doc as any).autoTable({
        head: [['Nome', 'Categoria', 'Tipo', 'Cidade', 'Contato']],
        body: tableData,
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillStyle: '#00897b' }
      });

      doc.save(`VidaLocal_Export_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erro ao exportar para PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-zinc-100 overflow-hidden">
      <div className="p-6 border-b border-zinc-100 bg-zinc-50">
        <h2 className="text-lg font-bold text-zinc-800 flex items-center gap-2">
          <Download className="w-5 h-5 text-[#00897b]" />
          Exportação de Dados
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          Gere relatórios em PDF ou Excel com filtros personalizados.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Estado</label>
            <select 
              value={stateUf}
              onChange={(e) => setStateUf(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00897b] outline-none"
            >
              <option value="">Todos os Estados</option>
              {states.map(s => <option key={s.id} value={s.uf}>{s.name} ({s.uf})</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Cidade</label>
            <select 
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00897b] outline-none"
            >
              <option value="">Todas as Cidades</option>
              {cities
                .filter(c => !stateUf || c.uf === stateUf)
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Categoria</label>
            <select 
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubCategory('');
              }}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00897b] outline-none"
            >
              <option value="">Todas as Categorias</option>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Subcategoria</label>
            <select 
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00897b] outline-none"
            >
              <option value="">Todas as Subcategorias</option>
              {SUB_CATEGORIES
                .filter(sc => !categoryId || sc.categoryId === Number(categoryId))
                .map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)
              }
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button 
            onClick={exportToExcel}
            disabled={isExporting}
            className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
            Exportar Excel (.xlsx)
          </button>
          
          <button 
            onClick={exportToPDF}
            disabled={isExporting}
            className="flex-1 min-w-[160px] flex items-center justify-center gap-2 px-6 py-3 bg-zinc-800 text-white font-bold rounded-2xl hover:bg-zinc-900 transition-all shadow-lg shadow-zinc-100 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Exportar PDF (.pdf)
          </button>
        </div>
      </div>
    </div>
  );
};
