'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Package, MapPin, LogOut, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import AddressForm from '@/components/store/AddressForm';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  product: {
    name: string;
    images: { url: string }[];
  };
  variant?: {
    color: string;
    imageUrl: string;
  };
}

interface Order {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string;
  items: OrderItem[];
}

interface Address {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  departmentId: string;
  department: { name: string };
  municipalityId: string;
  municipality: { name: string };
  address: string;
  neighborhood?: string;
  additionalInfo?: string;
  isDefault: boolean;
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  
  const router = useRouter();
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    setUserEmail(session.user.email || '');
    setAccessToken(session.access_token);

    try {
      const [ordersRes, addressesRes] = await Promise.all([
        fetch(`${API_URL}/orders/user/${session.user.id}`),
        fetch(`${API_URL}/addresses`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
      ]);

      if (ordersRes.ok) {
        const response = await ordersRes.json();
        setOrders(response.data || []);
      }

      if (addressesRes.ok) {
        const response = await addressesRes.json();
        setAddresses(response.data || []);
      } else {
        console.error('Addresses fetch failed:', await addressesRes.text());
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setAddresses([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase.auth, router, API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_role');
    router.push('/login');
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta dirección?')) return;

    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (res.ok) {
        toast.success('Dirección eliminada');
        fetchData();
      }
    } catch {
      toast.error('Error al eliminar la dirección');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ isDefault: true })
      });

      if (res.ok) {
        toast.success('Dirección predeterminada actualizada');
        fetchData();
      }
    } catch {
      toast.error('Error al actualizar la dirección');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-primary">Mi Cuenta</h1>
            <p className="text-muted mt-1">Bienvenido de nuevo, {userEmail}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-accent hover:opacity-80 font-bold px-4 py-2 bg-accent/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Info (Addresses) */}
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-xl border border-theme shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg flex items-center gap-2 text-primary">
                  <MapPin className="w-5 h-5" /> Direcciones Guardadas
                </h2>
                <button 
                  onClick={() => setShowAddressForm(true)}
                  className="p-1 hover:bg-base rounded-full transition-colors text-accent"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {addresses.length === 0 ? (
                  <p className="text-sm text-muted">Aún no tienes direcciones guardadas.</p>
                ) : (
                  addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className={`p-4 rounded-lg border transition-all ${
                        address.isDefault 
                          ? 'border-accent/50 bg-accent/5' 
                          : 'border-theme bg-base/30'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-accent mb-1 block">
                            {address.title}
                          </span>
                          <p className="text-sm font-bold text-primary">
                            {address.firstName} {address.lastName}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!address.isDefault && (
                            <button 
                              onClick={() => handleSetDefault(address.id)}
                              className="text-muted hover:text-accent transition-colors"
                              title="Marcar como predeterminada"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteAddress(address.id)}
                            className="text-muted hover:text-red-500 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">
                        {address.address}<br />
                        {address.neighborhood && `${address.neighborhood}, `}
                        {address.municipality.name}, {address.department.name}<br />
                        Tél: {address.phone}
                      </p>
                      {address.isDefault && (
                        <span className="mt-2 inline-block px-2 py-0.5 bg-accent text-surface text-[10px] font-bold rounded uppercase tracking-tighter">
                          Predeterminada
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={() => setShowAddressForm(true)}
                className="mt-6 w-full py-2 text-sm font-bold border border-theme rounded-lg text-primary hover:bg-base transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Agregar Dirección
              </button>
            </div>
          </div>

          {/* Orders List */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="font-bold text-xl flex items-center gap-2 text-primary">
              <Package className="w-5 h-5" /> Mis Pedidos
            </h2>

            {orders.length === 0 ? (
              <div className="bg-surface p-12 rounded-xl border border-dashed border-theme text-center">
                <p className="text-muted mb-4">Aún no has realizado ninguna compra.</p>
                <button 
                  onClick={() => router.push('/catalog')}
                  className="px-6 py-3 btn-primary text-sm font-bold uppercase tracking-wide rounded-sm"
                >
                  Ir a la Tienda
                </button>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-surface rounded-xl border border-theme shadow-sm overflow-hidden">
                  <div className="bg-primary/5 px-6 py-4 flex flex-wrap justify-between items-center gap-4 border-b border-theme">
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">Pedido #</span>
                        <span className="font-bold font-mono text-primary">{order.orderNumber}</span>
                      </div>
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">Fecha</span>
                        <span className="font-medium text-primary">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted text-xs uppercase tracking-wide">Total</span>
                        <span className="font-medium text-primary">
                          ${order.totalAmount.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        order.status === 'ENTREGADA' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        order.status === 'ENVIADA' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        order.status === 'CANCELADA' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-green-400' :
                        'bg-secondary/20 text-secondary'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex gap-4 items-center">
                          <div className="relative w-16 h-20 bg-base rounded-md overflow-hidden shrink-0 border border-theme">
                            <Image
                              src={item.variant?.imageUrl || item.product.images[0]?.url || '/placeholder.svg'}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-primary">{item.product.name}</h4>
                            <p className="text-sm text-muted">
                              {item.variant?.color} • Cantidad: {item.quantity}
                            </p>
                          </div>
                          <div className="text-right">
                             <p className="font-medium text-primary">
                               ${item.price.toLocaleString('es-CO')}
                             </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.trackingNumber && (
                      <div className="mt-6 pt-4 border-t border-theme flex items-center justify-between">
                         <div className="text-sm">
                           <span className="text-muted mr-2">Guía de rastreo:</span>
                           <span className="font-mono font-medium text-primary">{order.trackingNumber}</span>
                         </div>
                         <button className="text-sm font-bold underline decoration-1 text-primary hover:opacity-70 transition-opacity">
                           Rastrear Pedido
                         </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {showAddressForm && (
        <AddressForm 
          onClose={() => setShowAddressForm(false)}
          onSuccess={fetchData}
          apiUrl={API_URL}
          token={accessToken}
        />
      )}
    </>
  );
}