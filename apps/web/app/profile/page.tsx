'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/store/Navbar';
import Footer from '@/components/store/Footer';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Package, MapPin, LogOut } from 'lucide-react';
import Image from 'next/image';

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

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const router = useRouter();
  const supabase = createClient();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      setUserEmail(session.user.email || '');

      try {
        const res = await fetch(`${API_URL}/orders/user/${session.user.id}`);
        if (res.ok) {
          const response = await res.json();
          setOrders(response.data);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, supabase, API_URL]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_role');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base transition-colors duration-300">
      <Navbar />

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
          {/* Sidebar Info (Could be expanded) */}
          <div className="space-y-6">
            <div className="bg-surface p-6 rounded-xl border border-theme shadow-sm">
              <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-primary">
                <MapPin className="w-5 h-5" /> Direcciones Guardadas
              </h2>
              <p className="text-sm text-muted mb-4">Aún no tienes direcciones guardadas.</p>
              <button className="text-sm font-bold underline decoration-1 underline-offset-4 text-primary hover:opacity-70 transition-opacity">
                Agregar Dirección
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
                        order.status === 'CANCELADA' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
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
      <Footer />
    </div>
  );
}
