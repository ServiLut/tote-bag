'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Phone,
  DollarSign,
  Loader2,
  ChevronRight,
  MessageCircle,
  History,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

interface Supplier {
  id: string;
  name: string;
  nit: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  currentBalance: number;
  _count?: { batches: number };
}

interface SupplierDetails extends Supplier {
  batches: Array<{
    id: string;
    product: { name: string };
    quantityReceived: number;
    totalCost: number;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [details, setSupplierDetails] = useState<SupplierDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [formData, setFormData] = useState({
    name: '', nit: '', contact: '', email: '', phone: '', address: ''
  });
  const [paymentData, setPaymentData] = useState({ amount: 0, description: '' });
  const fetchSuppliers = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await apiFetch('/inventory/suppliers', { headers });
      if (res.ok) {
        const result = await res.json();
        setSuppliers(result.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  const fetchDetails = async (id: string) => {
    setDetailsLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await apiFetch(`/inventory/suppliers/${id}`, { headers });
      if (res.ok) {
        const result = await res.json();
        setSupplierDetails(result.data || null);
      }
    } catch (err) { console.error(err); }
    finally { setDetailsLoading(false); }
  };

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await apiFetch('/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', nit: '', contact: '', email: '', phone: '', address: '' });
        fetchSuppliers();
      }
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleCreateSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;
    setSubmitting(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await apiFetch(`/inventory/suppliers/${selectedSupplierId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(paymentData),
      });
      if (res.ok) {
        setIsPaymentModalOpen(false);
        setPaymentData({ amount: 0, description: '' });
        fetchDetails(selectedSupplierId);
        fetchSuppliers();
      }
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
              <Truck className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Directorio de Proveedores</h1>
          </div>
          <p className="text-muted font-medium">Gestión de alianzas comerciales y cuentas por pagar.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-base-color font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Nuevo Proveedor
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Suppliers List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-theme bg-base/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text" placeholder="Buscar por nombre o NIT..."
                  className="w-full pl-10 pr-4 py-2.5 bg-base border border-theme rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                    <th className="px-8 py-4">Empresa / NIT</th>
                    <th className="px-8 py-4">Contacto</th>
                    <th className="px-8 py-4">Saldo Pendiente</th>
                    <th className="px-8 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {loading ? (
                    <tr><td colSpan={4} className="px-8 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
                  ) : suppliers.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => { setSelectedSupplierId(s.id); fetchDetails(s.id); }}
                      className={`hover:bg-primary/5 transition-all cursor-pointer group ${selectedSupplierId === s.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-primary group-hover:translate-x-1 transition-transform">{s.name}</span>
                          <span className="text-[10px] font-black text-muted uppercase tracking-widest">{s.nit}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm font-medium text-muted">{s.contact || 'No asignado'}</td>
                      <td className="px-8 py-5">
                        <span className={`font-black text-base ${s.currentBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(s.currentBalance)}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end">
                          <div className="p-2 rounded-lg bg-base border border-theme group-hover:bg-primary group-hover:text-base-color transition-all">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          {selectedSupplierId ? (
            detailsLoading ? (
              <div className="bg-surface border border-theme rounded-3xl p-12 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-xs font-black text-muted uppercase tracking-widest">Cargando Estado de Cuenta...</p>
              </div>
            ) : details && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                {/* Profile Card */}
                <div className="bg-primary text-base-color rounded-3xl p-8 shadow-xl shadow-primary/20 relative overflow-hidden">
                  <div className="relative z-10 space-y-6">
                    <div>
                      <h2 className="text-2xl font-black">{details.name}</h2>
                      <p className="text-base-color/60 font-bold text-xs uppercase tracking-widest">{details.nit}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <a href={`tel:${details.phone}`} className="flex items-center gap-3 p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-all">
                        <Phone className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">Llamar</span>
                      </a>
                      <a href={`https://wa.me/${details.phone}`} className="flex items-center gap-3 p-3 bg-emerald-500 rounded-2xl hover:bg-emerald-600 transition-all">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase">WhatsApp</span>
                      </a>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase text-white/40 mb-1">Deuda Actual</p>
                      <p className="text-3xl font-black">{formatCurrency(details.currentBalance)}</p>
                    </div>
                  </div>
                  <Truck className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                </div>

                {/* Account Tabs (Visual) */}
                <div className="bg-surface border border-theme rounded-3xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-primary uppercase text-xs tracking-widest flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Historial Reciente
                    </h3>
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="text-[10px] font-black uppercase bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-all"
                    >
                      Abonar Pago
                    </button>
                  </div>

                  <div className="space-y-4">
                    {details.batches.length === 0 && details.transactions.length === 0 ? (
                      <p className="text-center py-8 text-xs font-bold text-muted italic">Sin movimientos registrados.</p>
                    ) : (
                      <div className="space-y-3">
                        {details.batches.slice(0, 3).map(b => (
                          <div key={b.id} className="flex items-center justify-between p-3 bg-base rounded-xl border border-theme">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-muted uppercase">Lote: {b.product.name}</span>
                              <span className="text-xs font-bold text-primary">{format(new Date(b.createdAt), 'dd MMM')}</span>
                            </div>
                            <span className="text-xs font-black text-rose-500">+{formatCurrency(b.totalCost)}</span>
                          </div>
                        ))}
                        {details.transactions.slice(0, 3).map(t => (
                          <div key={t.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-emerald-600 uppercase">Pago / Abono</span>
                              <span className="text-xs font-bold text-emerald-700">{format(new Date(t.createdAt), 'dd MMM')}</span>
                            </div>
                            <span className="text-xs font-black text-emerald-600">-{formatCurrency(t.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-surface border border-theme border-dashed rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 bg-base rounded-full">
                <Truck className="w-8 h-8 text-muted" />
              </div>
              <p className="text-sm font-bold text-muted max-w-[200px]">Selecciona un proveedor para ver su estado de cuenta.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-theme bg-primary text-base-color">
              <h2 className="text-2xl font-black">Nuevo Proveedor</h2>
              <p className="text-base-color/60 text-sm font-medium">Registra una nueva alianza estratégica.</p>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-full space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Nombre de Empresa</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">NIT / RUT</label>
                  <input required value={formData.nit} onChange={e => setFormData({...formData, nit: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Contacto Directo</label>
                  <input value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Teléfono</label>
                  <input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-muted">Correo</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-base border border-theme rounded-2xl font-bold text-muted">Cancelar</button>
                <button disabled={submitting} className="flex-[2] px-6 py-4 bg-primary text-base-color font-black rounded-2xl flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Guardar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-theme bg-rose-500 text-white">
              <h2 className="text-2xl font-black">Registrar Pago</h2>
              <p className="text-rose-100 text-sm font-medium">Abonar saldo pendiente a {details?.name}.</p>
            </div>
            <form onSubmit={handleCreateSupplierPayment} className="p-8 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted">Monto del Pago</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input required type="number" value={paymentData.amount || ''} onChange={e => setPaymentData({...paymentData, amount: parseFloat(e.target.value)})} className="w-full bg-base border border-theme rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/20" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted">Concepto / Descripción</label>
                <input required value={paymentData.description} onChange={e => setPaymentData({...paymentData, description: e.target.value})} placeholder="Ej: Abono factura #123" className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-rose-500/20" />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 px-6 py-4 bg-base border border-theme rounded-2xl font-bold text-muted">Cancelar</button>
                <button disabled={submitting} className="flex-[2] px-6 py-4 bg-rose-500 text-white font-black rounded-2xl flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
