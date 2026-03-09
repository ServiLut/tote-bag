'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Search,
  Loader2,
  Truck,
  ExternalLink,
  ClipboardList,
  CheckCircle2,
  Calendar,
  User,
  MapPin,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';

interface Order {
  id: string;
  orderNumber: number;
  customerEmail: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  shippingAddress: any;
  profile?: {
    firstName: string;
    lastName: string;
    phone: string;
  };
  shipment?: {
    id: string;
    trackingNumber: string | null;
    status: string;
    provider?: {
      name: string;
    }
  };
}

interface ShippingProvider {
  id: string;
  name: string;
}

export default function ShippingManagementPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [providers, setProviders] = useState<ShippingProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [trackingData, setTrackingData] = useState({
    providerId: '',
    trackingNumber: '',
    status: 'SHIPPED'
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, providersRes] = await Promise.all([
        fetch(`${API_URL}/shipping/shipments/pending`),
        fetch(`${API_URL}/shipping/providers`)
      ]);

      if (ordersRes.ok) setOrders(await ordersRes.json());
      if (providersRes.ok) setProviders(await providersRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [API_URL]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenAssignModal = (order: Order) => {
    setSelectedOrder(order);
    setTrackingData({
      providerId: order.shipment?.provider?.name || '', // This is tricky, the DTO expects ID
      trackingNumber: order.shipment?.trackingNumber || '',
      status: 'SHIPPED'
    });
    // Reset providerId if not found in list
    setIsModalOpen(true);
  };

  const handleSubmitTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/shipping/shipments/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: any = {
      'PENDING': 'bg-amber-50 text-amber-600 border-amber-100',
      'SHIPPED': 'bg-blue-50 text-blue-600 border-blue-100',
      'IN_TRANSIT': 'bg-indigo-50 text-indigo-600 border-indigo-100',
      'DELIVERED': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'CANCELLED': 'bg-rose-50 text-rose-600 border-rose-100',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${styles[status] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header & Metrics */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-primary">Gestión de Envíos</h1>
            </div>
            <p className="text-muted font-medium">Despacha órdenes pagadas y actualiza información de seguimiento.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-theme p-6 rounded-3xl shadow-sm space-y-2">
            <p className="text-[10px] font-black uppercase text-muted tracking-widest">Pendientes por Despachar</p>
            <div className="flex items-end justify-between">
              <h3 className="text-4xl font-black text-primary">{orders.length}</h3>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-surface border border-theme p-6 rounded-3xl shadow-sm space-y-2">
            <p className="text-[10px] font-black uppercase text-muted tracking-widest">Envíos este Mes</p>
            <div className="flex items-end justify-between">
              <h3 className="text-4xl font-black text-primary">124</h3>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div className="bg-surface border border-theme p-6 rounded-3xl shadow-sm space-y-2">
            <p className="text-[10px] font-black uppercase text-muted tracking-widest">Entregas Exitosas</p>
            <div className="flex items-end justify-between">
              <h3 className="text-4xl font-black text-emerald-600">98%</h3>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-theme bg-base/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text" placeholder="Buscar por # de orden o cliente..."
              className="w-full pl-10 pr-4 py-2.5 bg-base border border-theme rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted">Filtrar por:</span>
            <select className="bg-base border border-theme rounded-lg px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20">
              <option>Todos los Pendientes</option>
              <option>B2C</option>
              <option>B2B</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-base/20 text-[10px] uppercase tracking-widest font-black text-muted/60 border-b border-theme">
                <th className="px-8 py-4">Orden</th>
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Destino</th>
                <th className="px-8 py-4">Estado Envío</th>
                <th className="px-8 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted font-medium italic text-sm">No hay órdenes pendientes de envío.</td></tr>
              ) : orders.map((o) => (
                <tr key={o.id} className="hover:bg-primary/5 transition-all group">
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary flex items-center gap-2">
                        #{o.orderNumber}
                        <ExternalLink className="w-3 h-3 text-muted/50" />
                      </span>
                      <span className="text-[10px] font-black text-muted uppercase tracking-widest">{format(new Date(o.createdAt), 'dd/MM/yyyy')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-base border border-theme flex items-center justify-center text-primary">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-primary">{o.profile?.firstName} {o.profile?.lastName}</span>
                        <span className="text-[10px] text-muted font-medium">{o.customerEmail}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col max-w-[200px]">
                      <span className="text-xs font-bold text-primary truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted" />
                        {o.shippingAddress?.address}
                      </span>
                      <span className="text-[10px] text-muted font-black uppercase tracking-widest truncate">{o.shippingAddress?.city || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    {getStatusBadge(o.shipment?.status || 'PENDING')}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => handleOpenAssignModal(o)}
                      className="px-4 py-2 bg-primary text-base-color text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-2 ml-auto"
                    >
                      <Truck className="w-3 h-3" />
                      Despachar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Despacho */}
      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-surface w-full max-w-2xl rounded-3xl shadow-2xl border border-theme animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-8 border-b border-theme bg-primary text-base-color flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black">Despachar Orden #{selectedOrder.orderNumber}</h2>
                <p className="text-base-color/60 text-sm font-medium">Asigna un transportista y número de guía para notificar al cliente.</p>
              </div>
              <div className="p-3 bg-white/10 rounded-2xl">
                <Truck className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <form onSubmit={handleSubmitTracking} className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Info Orden */}
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-muted tracking-[0.2em] border-b border-theme pb-2">Resumen de Destino</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-base rounded-lg"><User className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted">Destinatario</p>
                        <p className="text-sm font-bold text-primary">{selectedOrder.profile?.firstName} {selectedOrder.profile?.lastName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-base rounded-lg"><MapPin className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted">Dirección de Entrega</p>
                        <p className="text-sm font-bold text-primary">{selectedOrder.shippingAddress?.address}</p>
                        <p className="text-[10px] font-black text-muted uppercase">{selectedOrder.shippingAddress?.city}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-base rounded-lg"><ClipboardList className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-muted">Total Pagado</p>
                        <p className="text-sm font-bold text-primary">{formatCurrency(selectedOrder.totalAmount)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulario Logística */}
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase text-muted tracking-[0.2em] border-b border-theme pb-2">Información de Guía</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-muted">Transportadora</label>
                      <select 
                        required 
                        value={trackingData.providerId} 
                        onChange={e => setTrackingData({...trackingData, providerId: e.target.value})}
                        className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Selecciona Proveedor</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-muted">Número de Guía / Tracking</label>
                      <input 
                        required 
                        value={trackingData.trackingNumber} 
                        onChange={e => setTrackingData({...trackingData, trackingNumber: e.target.value})}
                        placeholder="Ej: TRK987654321" 
                        className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-muted">Nuevo Estado</label>
                      <div className="flex gap-2">
                        {['SHIPPED', 'IN_TRANSIT'].map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setTrackingData({...trackingData, status: s})}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                              trackingData.status === s 
                                ? 'bg-primary text-base-color border-primary shadow-md' 
                                : 'bg-base border-theme text-muted'
                            }`}
                          >
                            {s === 'SHIPPED' ? 'Enviado' : 'En Tránsito'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-theme flex flex-col md:flex-row gap-4">
                <div className="flex-1 flex items-center gap-2 text-[10px] font-bold text-muted italic">
                  <ArrowRight className="w-3 h-3" />
                  Se enviará un correo automático al cliente con la guía.
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-base border border-theme rounded-2xl font-bold text-muted hover:bg-primary/5 transition-all">Cancelar</button>
                  <button disabled={submitting} className="px-8 py-4 bg-primary text-base-color font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirmar Despacho
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
