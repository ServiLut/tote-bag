'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, CalendarClock, Box, Phone, MapPin, Truck, Eye, X, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiResponse } from '@/types/api';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type OrderStatus = 'PENDIENTE_PAGO' | 'PAGADA' | 'EN_PRODUCCION' | 'ENVIADA' | 'ENTREGADA' | 'CANCELADA';

interface OrderItem {
  id: string;
  sku: string;
  quantity: number;
  price: number;
  product: {
    name: string;
    collection: string;
    images: string[];
  };
}

interface Order {
  id: string;
  orderNumber: number;
  customerEmail: string;
  customerPhone: string;
  city: string;
  shippingAddress: string;
  totalAmount: number;
  status: OrderStatus;
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  items: OrderItem[];
}

interface BatchItem {
  sku: string;
  name: string;
  image?: string;
  totalQuantity: number;
}

export default function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'batch'>('list');
  const [filter, setFilter] = useState<'all' | 'cutoff'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  // Form states for modal
  const [newStatus, setNewStatus] = useState<OrderStatus>('PENDIENTE_PAGO');
  const [tracking, setTracking] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${API_URL}/orders`);
        if (!res.ok) throw new Error('Failed to fetch orders');
        const responseBody: ApiResponse<Order[]> = await res.json();
        setOrders(responseBody.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [API_URL]);

  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setTracking(order.trackingNumber || '');
  };

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
    setUpdating(true);
    
    try {
      const res = await fetch(`${API_URL}/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          trackingNumber: tracking || null
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id ? { ...o, status: newStatus, trackingNumber: tracking } : o
      ));
      
      setSelectedOrder(null); // Close modal
      alert('Orden actualizada correctamente');
    } catch {
      alert('Error al actualizar la orden');
    } finally {
      setUpdating(false);
    }
  };

  const getFilteredOrders = () => {
    if (filter === 'all') return orders;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const isToday = orderDate.getFullYear() === today.getFullYear() &&
                      orderDate.getMonth() === today.getMonth() &&
                      orderDate.getDate() === today.getDate();
      
      const isBeforeCutoff = orderDate.getHours() < 12;
      return isToday && isBeforeCutoff;
    });
  };

  const getBatchGrouping = (filteredOrders: Order[]): BatchItem[] => {
    const map = new Map<string, BatchItem>();

    filteredOrders.forEach(order => {
      // Solo contar órdenes pagadas o en producción para lotes
      if (['PENDIENTE_PAGO', 'CANCELADA'].includes(order.status)) return;

      order.items.forEach(item => {
        const existing = map.get(item.sku);
        if (existing) {
          existing.totalQuantity += item.quantity;
        } else {
          map.set(item.sku, {
            sku: item.sku,
            name: item.product.name,
            image: item.product.images?.[0],
            totalQuantity: item.quantity
          });
        }
      });
    });

    return Array.from(map.values());
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case 'PAGADA': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800';
      case 'EN_PRODUCCION': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'ENVIADA': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'ENTREGADA': return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
      case 'CANCELADA': return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-100 dark:border-red-900/30';
      default: return 'bg-gray-50 dark:bg-zinc-800/50 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700';
    }
  };

  const sendWhatsApp = (phone: string, orderNumber: number) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Hola! Tu pedido #${orderNumber} de Tote Bags está siendo procesado. Te enviaremos la guía pronto.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredOrders = getFilteredOrders();
  const batchItems = getBatchGrouping(filteredOrders);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-surface p-6 rounded-2xl border border-theme shadow-sm">
        <div>
          <h2 className="text-xl font-black text-primary tracking-tight">Gestión de Pedidos</h2>
          <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">
            {filter === 'cutoff' ? 'Corte Producción: HOY (antes 12:00 m)' : 'Historial de ventas'}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => setFilter(filter === 'all' ? 'cutoff' : 'all')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all active:scale-95",
              filter === 'cutoff' 
                ? "bg-accent/10 border-accent/30 text-accent shadow-sm" 
                : "bg-surface border-theme text-muted hover:text-primary hover:bg-base"
            )}
          >
            <CalendarClock className="w-4 h-4" />
            {filter === 'cutoff' ? 'Ver Todo' : 'Filtro 12:00'}
          </button>
          
          <button
            onClick={() => setView(view === 'list' ? 'batch' : 'list')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase transition-all active:scale-95",
              view === 'batch' 
                ? "bg-primary border-primary text-base-color shadow-lg shadow-primary/10" 
                : "bg-surface border-theme text-muted hover:text-primary hover:bg-base"
            )}
          >
            <Box className="w-4 h-4" />
            {view === 'batch' ? 'Lista' : 'Lotes'}
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-theme shadow-sm bg-surface">
          <table className="w-full divide-y divide-theme text-sm text-left">
            <thead>
              <tr className="bg-base/50">
                <th className="px-6 py-4 font-bold text-primary uppercase text-[10px] tracking-widest">Orden</th>
                <th className="px-6 py-4 font-bold text-primary uppercase text-[10px] tracking-widest">Cliente</th>
                <th className="px-6 py-4 font-bold text-primary uppercase text-[10px] tracking-widest">Estado</th>
                <th className="px-6 py-4 font-bold text-primary uppercase text-[10px] tracking-widest">Total</th>
                <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted font-medium bg-surface">
                    No se encontraron pedidos con este filtro.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-base/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-black text-primary tracking-tight">#{order.orderNumber}</div>
                      <div className="text-[10px] text-muted font-bold uppercase tracking-tighter">
                        {new Date(order.createdAt).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-primary text-xs">{order.customerEmail}</div>
                      <div className="text-[10px] text-muted font-medium truncate max-w-[150px]" title={order.city}>{order.city}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-md text-[9px] font-black uppercase border tracking-widest", getStatusColor(order.status))}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-primary">
                      ${order.totalAmount.toLocaleString('es-CO')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openOrderModal(order)}
                        className="p-2.5 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
                        title="Gestionar Orden"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batchItems.map((batch) => (
            <div key={batch.sku} className="p-6 rounded-2xl border border-theme bg-surface shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
              <div className="flex gap-4">
                <div className="h-16 w-16 rounded-xl overflow-hidden border border-theme bg-base flex-shrink-0 shadow-sm relative">
                  <Image 
                    src={batch.image || '/placeholder.svg'} 
                    alt={batch.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                    unoptimized
                  />
                </div>
                <div>
                  <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{batch.sku}</div>
                  <h3 className="font-black text-primary text-sm leading-tight">{batch.name}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-theme/50">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Total Lote</span>
                <span className="text-3xl font-black text-primary tracking-tighter">{batch.totalQuantity}</span>
              </div>
            </div>
          ))}
          {batchItems.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted bg-base/30 rounded-2xl border-2 border-dashed border-theme font-medium">
              No hay items pendientes para producción.
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 relative border border-theme">
            {/* Header */}
            <div className="px-6 py-5 border-b border-theme flex justify-between items-center bg-base/50">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-black text-primary tracking-tight">Orden #{selectedOrder.orderNumber}</h3>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase border tracking-widest", getStatusColor(selectedOrder.status))}>
                  {selectedOrder.status.replace('_', ' ')}
                </span>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2.5 hover:bg-base rounded-xl transition-all text-muted hover:text-primary active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Customer Info */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Cliente
                </h4>
                <div className="text-sm space-y-2">
                  <p className="font-bold text-primary">{selectedOrder.customerEmail}</p>
                  <p className="text-muted font-medium">{selectedOrder.customerPhone}</p>
                  <p className="text-muted font-medium">{selectedOrder.city}</p>
                  <div className="p-4 bg-base/40 rounded-2xl border border-theme mt-2">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 opacity-60">Dirección</p>
                    <p className="text-xs text-primary font-bold">{selectedOrder.shippingAddress}</p>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                  <Box className="w-3.5 h-3.5" /> Productos ({selectedOrder.items.length})
                </h4>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {selectedOrder.items.map(item => (
                    <div key={item.id} className="flex gap-4 items-center p-2 rounded-xl hover:bg-base/30 transition-colors">
                      <div className="h-12 w-12 rounded-lg border border-theme bg-base overflow-hidden flex-shrink-0 relative shadow-sm">
                        <Image 
                          src={item.product.images?.[0] || '/placeholder.svg'} 
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary truncate uppercase tracking-tight">{item.product.name}</p>
                        <p className="text-[9px] text-muted font-black font-mono tracking-widest">{item.sku}</p>
                      </div>
                      <div className="text-xs font-black text-primary bg-base px-2 py-1 rounded-md border border-theme">x{item.quantity}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-theme flex justify-between items-center">
                  <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Total</span>
                  <span className="text-2xl font-black text-primary tracking-tighter">${selectedOrder.totalAmount.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>

            {/* Management Section */}
            <div className="p-8 bg-base/50 border-t border-theme space-y-6">
              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <Truck className="w-3.5 h-3.5" /> Gestión de Estado
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Estado del Pedido</label>
                  <select 
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full p-3 rounded-xl border border-theme bg-surface text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="PENDIENTE_PAGO">Pendiente Pago</option>
                    <option value="PAGADA">Pagada</option>
                    <option value="EN_PRODUCCION">En Producción</option>
                    <option value="ENVIADA">Enviada</option>
                    <option value="ENTREGADA">Entregada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Número de Guía</label>
                  <input 
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="Ej. GUIA-123456"
                    className="w-full p-3 rounded-xl border border-theme bg-surface text-primary font-bold text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-muted/30 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                <button
                  onClick={() => sendWhatsApp(selectedOrder.customerPhone, selectedOrder.orderNumber)}
                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors active:scale-95 px-4 py-2 hover:bg-green-500/10 rounded-xl"
                >
                  <Phone className="w-3.5 h-3.5" /> Contactar WhatsApp
                </button>
                <button
                  onClick={handleUpdateOrder}
                  disabled={updating}
                  className="w-full sm:w-auto bg-primary text-base-color px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-primary/10 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
