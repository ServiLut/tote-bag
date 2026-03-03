'use client';

import { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Loader2, 
  CheckCircle2, 
  X,
  TrendingDown,
  User,
  Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OpexCategory {
  id: string;
  name: string;
}

interface OpexTransaction {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
  category: string;
  opexCategory: { name: string };
  user: { email: string };
}

export default function OpexPage() {
  const [transactions, setTransactions] = useState<OpexTransaction[]>([]);
  const [categories, setCategories] = useState<OpexCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Form State
  const [formData, setFormData] = useState({
    description: '',
    opexCategoryId: '',
    amount: 0,
    createdAt: new Date().toISOString().split('T')[0],
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

  const fetchData = async () => {
    try {
      const [txRes, catRes] = await Promise.all([
        fetch(`${API_URL}/inventory/finance/opex-transactions`),
        fetch(`${API_URL}/inventory/finance/opex-categories`),
      ]);

      if (txRes.ok) setTransactions(await txRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [API_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/inventory/finance/opex`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          description: '',
          opexCategoryId: '',
          amount: 0,
          createdAt: new Date().toISOString().split('T')[0],
        });
        fetchData();
      }
    } catch (err) {
      console.error('Error creating OpEx:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const currentMonthTotal = transactions
    .filter(tx => {
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, tx) => sum + tx.amount, 0);

  const filteredTransactions = transactions.filter(tx => 
    filterCategory === 'ALL' || tx.opexCategoryId === filterCategory
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500 rounded-xl text-white shadow-lg shadow-rose-200">
              <Receipt className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Gastos Operativos</h1>
          </div>
          <p className="text-muted font-medium">Control y registro de egresos no relacionados directamente con la producción.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-200 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Registrar Gasto
        </button>
      </div>

      {/* Summary Banner */}
      <div className="bg-rose-50 border border-rose-100 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white rounded-2xl shadow-sm">
            <TrendingDown className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-400">Total Gastado este Mes</p>
            <h2 className="text-4xl font-black text-rose-600">{formatCurrency(currentMonthTotal)}</h2>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-rose-500/80 max-w-xs">
            Este valor incluye nómina, servicios, arriendo y otros gastos fijos del periodo actual.
          </p>
        </div>
      </div>

      {/* Control Table */}
      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
        <div className="p-8 border-b border-theme bg-base/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <Search className="w-5 h-5 text-muted" />
            Control de Egresos
          </h2>
          <div className="flex items-center gap-3">
             <Filter className="w-4 h-4 text-muted" />
             <select 
               value={filterCategory}
               onChange={(e) => setFilterCategory(e.target.value)}
               className="bg-base border border-theme rounded-xl px-4 py-2 text-xs font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20 transition-all"
             >
               <option value="ALL">Todas las Categorías</option>
               {categories.map(cat => (
                 <option key={cat.id} value={cat.id}>{cat.name}</option>
               ))}
             </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-8 py-4">Fecha</th>
                <th className="px-8 py-4">Categoría</th>
                <th className="px-8 py-4">Descripción</th>
                <th className="px-8 py-4">Monto</th>
                <th className="px-8 py-4">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-muted font-medium">
                    No se encontraron gastos registrados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-rose-50/30 transition-colors group text-sm">
                    <td className="px-8 py-5 font-medium text-muted">
                      {format(new Date(tx.createdAt), 'dd MMM, yyyy', { locale: es })}
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                        <Tag className="w-3 h-3" />
                        {tx.opexCategory?.name}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-primary">
                      {tx.description}
                    </td>
                    <td className="px-8 py-5 font-black text-rose-600">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted">
                        <div className="w-6 h-6 rounded-full bg-theme flex items-center justify-center">
                          <User className="w-3 h-3" />
                        </div>
                        {tx.user?.email.split('@')[0]}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="p-8 border-b border-theme bg-rose-500 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black">Registrar Gasto</h2>
                  <p className="text-rose-100 font-medium text-sm mt-1">Ingresa un nuevo egreso operativo.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Descripción</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago internet Febrero"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Categoría</label>
                    <select
                      required
                      value={formData.opexCategoryId}
                      onChange={(e) => setFormData({ ...formData, opexCategoryId: e.target.value })}
                      className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                    >
                      <option value="">Seleccionar...</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">Monto</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="0"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        className="w-full bg-base border border-theme rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">Fecha de Pago</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="date"
                      required
                      value={formData.createdAt}
                      onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                      className="w-full bg-base border border-theme rounded-xl pl-10 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-rose-500/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-base rounded-2xl border border-theme group">
                  <input 
                    type="checkbox" 
                    id="recurring" 
                    className="w-5 h-5 rounded-lg border-theme text-rose-500 focus:ring-rose-500/20 transition-all cursor-pointer" 
                  />
                  <label htmlFor="recurring" className="text-sm font-bold text-muted group-hover:text-primary cursor-pointer transition-colors">
                    Marcar como gasto recurrente
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-base border border-theme rounded-2xl font-bold text-muted hover:bg-theme/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-[2] px-6 py-4 bg-rose-500 text-white font-black rounded-2xl shadow-xl shadow-rose-200 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Confirmar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
