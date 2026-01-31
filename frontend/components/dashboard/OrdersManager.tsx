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
      case 'PAGADA': return 'bg-green-100 text-green-800 border-green-200';
      case 'EN_PRODUCCION': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'ENVIADA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ENTREGADA': return 'bg-zinc-100 text-zinc-800 border-zinc-200';
      case 'CANCELADA': return 'bg-red-50 text-red-800 border-red-100';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
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

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-zinc-400" /></div>;

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Gestión de Pedidos</h2>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-1">
            {filter === 'cutoff' ? 'Corte Producción: HOY (ante 12:00 m)' : 'Historial de ventas'}
          </p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => setFilter(filter === 'all' ? 'cutoff' : 'all')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase transition-all",
              filter === 'cutoff' 
                ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" 
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <CalendarClock className="w-4 h-4" />
            {filter === 'cutoff' ? 'Ver Todo' : 'Filtro 12:00'}
          </button>
          
          <button
            onClick={() => setView(view === 'list' ? 'batch' : 'list')}
            className={cn(
              "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase transition-all",
              view === 'batch' 
                ? "bg-zinc-900 border-zinc-900 text-white shadow-lg" 
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
            )}
          >
            <Box className="w-4 h-4" />
            {view === 'batch' ? 'Lista' : 'Lotes'}
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-sm bg-white">
          <table className="w-full divide-y divide-zinc-200 text-sm">
            <thead>
              <tr className="bg-zinc-50/50">
                <th className="px-6 py-4 text-left font-semibold text-zinc-900 uppercase text-[10px] tracking-widest">Orden</th>
                <th className="px-6 py-4 text-left font-semibold text-zinc-900 uppercase text-[10px] tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-left font-semibold text-zinc-900 uppercase text-[10px] tracking-widest">Estado</th>
                <th className="px-6 py-4 text-left font-semibold text-zinc-900 uppercase text-[10px] tracking-widest">Total</th>
                <th className="px-6 py-4 text-right font-semibold text-zinc-900 uppercase text-[10px] tracking-widest">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 font-medium">
                    No se encontraron pedidos con este filtro.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 tracking-tight">#{order.orderNumber}</div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">
                        {new Date(order.createdAt).toLocaleString('es-CO', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-zinc-900 text-xs">{order.customerEmail}</div>
                      <div className="text-[10px] text-zinc-500 font-medium truncate max-w-[150px]" title={order.city}>{order.city}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border tracking-wider", getStatusColor(order.status))}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">
                      ${order.totalAmount.toLocaleString('es-CO')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openOrderModal(order)}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
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
            <div key={batch.sku} className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-sm flex flex-col justify-between hover:shadow-md transition-all group">
              <div className="flex gap-4">
                <div className="h-16 w-16 rounded-xl overflow-hidden border border-zinc-100 bg-zinc-50 flex-shrink-0 shadow-sm relative">
                  <Image 
                    src={batch.image || '/placeholder.svg'} 
                    alt={batch.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                    unoptimized
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{batch.sku}</div>
                  <h3 className="font-bold text-zinc-900 text-sm leading-tight">{batch.name}</h3>
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-50">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Lote</span>
                <span className="text-3xl font-black text-black tracking-tighter">{batch.totalQuantity}</span>
              </div>
            </div>
          ))}
          {batchItems.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-400 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200 font-medium">
              No hay items pendientes para producción.
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-10 zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-zinc-900">Orden #{selectedOrder.orderNumber}</h3>
                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border", getStatusColor(selectedOrder.status))}>
                  {selectedOrder.status.replace('_', ' ')}
                </span>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Customer Info */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> Cliente
                </h4>
                <div className="text-sm space-y-1">
                  <p className="font-semibold text-zinc-900">{selectedOrder.customerEmail}</p>
                  <p className="text-zinc-600">{selectedOrder.customerPhone}</p>
                  <p className="text-zinc-600">{selectedOrder.city}</p>
                  <p className="text-zinc-500 text-xs mt-2 p-2 bg-zinc-50 rounded border border-zinc-100">{selectedOrder.shippingAddress}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Box className="w-3 h-3" /> Productos ({selectedOrder.items.length})
                </h4>
                <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                  {selectedOrder.items.map(item => (
                    <div key={item.id} className="flex gap-3 items-center">
                      <div className="h-10 w-10 rounded border border-zinc-200 overflow-hidden flex-shrink-0 relative">
                        <Image 
                          src={item.product.images?.[0] || '/placeholder.svg'} 
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{item.product.name}</p>
                        <p className="text-xs text-zinc-500 font-mono">{item.sku}</p>
                      </div>
                      <div className="text-sm font-bold text-zinc-900">x{item.quantity}</div>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-500">Total</span>
                  <span className="text-lg font-bold text-zinc-900">${selectedOrder.totalAmount.toLocaleString('es-CO')}</span>
                </div>
              </div>
            </div>

            {/* Management Section */}
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                <Truck className="w-3 h-3" /> Gestión de Estado
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Estado del Pedido</label>
                  <select 
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-sm focus:ring-2 focus:ring-black outline-none"
                  >
                    <option value="PENDIENTE_PAGO">Pendiente Pago</option>
                    <option value="PAGADA">Pagada</option>
                    <option value="EN_PRODUCCION">En Producción</option>
                    <option value="ENVIADA">Enviada</option>
                    <option value="ENTREGADA">Entregada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-600">Número de Guía</label>
                  <input 
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="Ej. GUIA-123456"
                    className="w-full p-2.5 rounded-lg border border-zinc-200 bg-white text-sm focus:ring-2 focus:ring-black outline-none placeholder:text-zinc-300"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => sendWhatsApp(selectedOrder.customerPhone, selectedOrder.orderNumber)}
                  className="text-green-600 hover:text-green-700 text-xs font-bold uppercase tracking-wide flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" /> Contactar por WhatsApp
                </button>
                <button
                  onClick={handleUpdateOrder}
                  disabled={updating}
                  className="bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50"
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