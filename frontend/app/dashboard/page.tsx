import Link from 'next/link';
import { ArrowRight, TrendingUp, AlertTriangle, Briefcase, ShoppingBag, Package } from 'lucide-react';
import { ApiResponse } from '@/types/api';

interface Order {
  id: string;
  createdAt: string;
}

interface Variant {
  stock: number;
}

interface Product {
  variants: Variant[];
}

async function getDashboardStats() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  
  try {
    const [ordersRes, productsRes, quotesRes] = await Promise.all([
      fetch(`${API_URL}/orders`, { cache: 'no-store' }),
      fetch(`${API_URL}/products/list`, { cache: 'no-store' }),
      fetch(`${API_URL}/b2b/quotes`, { cache: 'no-store' }),
    ]);

    const ordersBody: ApiResponse<Order[]> | null = ordersRes.ok ? await ordersRes.json() : null;
    const orders = ordersBody?.data || [];

    const productsBody: ApiResponse<Product[]> | null = productsRes.ok ? await productsRes.json() : null;
    const products = productsBody?.data || [];

    const quotesBody: ApiResponse<unknown[]> | null = quotesRes.ok ? await quotesRes.json() : null;
    const quotes = quotesBody?.data || [];

    const today = new Date().toDateString();
    const dailyProduction = orders.filter((o) => 
      new Date(o.createdAt).toDateString() === today
    ).length;

    let lowStockCount = 0;
    products.forEach((p) => {
      if (p.variants) {
        p.variants.forEach((v) => {
          if (v.stock < 10) lowStockCount++;
        });
      }
    });

    const pendingQuotes = quotes.length;

    return {
      dailyProduction,
      lowStockCount,
      pendingQuotes
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      dailyProduction: 0,
      lowStockCount: 0,
      pendingQuotes: 0
    };
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Resumen Diario</h1>
          <p className="text-zinc-500 mt-1 text-sm font-medium">Vista general de operaciones y alertas.</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium text-zinc-900">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Producción */}
        <div className="group bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:scale-110 transition-transform duration-300">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12%
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 mb-1">Pedidos Hoy</p>
            <h3 className="text-4xl font-bold text-zinc-900 tracking-tight">{stats.dailyProduction}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-50">
            <Link href="/dashboard/orders" className="text-sm text-zinc-600 font-medium flex items-center hover:text-blue-600 transition-colors group-hover:translate-x-1">
              Ver detalle de producción <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Card 2: Inventario */}
        <div className="group bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 group-hover:scale-110 transition-transform duration-300">
              <Package className="w-6 h-6" />
            </div>
            {stats.lowStockCount > 0 && (
              <span className="flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Atención
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 mb-1">Stock Crítico</p>
            <h3 className="text-4xl font-bold text-zinc-900 tracking-tight">{stats.lowStockCount}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-50">
            <Link href="/dashboard/products" className="text-sm text-zinc-600 font-medium flex items-center hover:text-amber-600 transition-colors group-hover:translate-x-1">
              Gestionar inventario <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Card 3: B2B */}
        <div className="group bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100 transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600 group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-500 mb-1">Cotizaciones B2B</p>
            <h3 className="text-4xl font-bold text-zinc-900 tracking-tight">{stats.pendingQuotes}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-50">
            <Link href="/dashboard/b2b" className="text-sm text-zinc-600 font-medium flex items-center hover:text-purple-600 transition-colors group-hover:translate-x-1">
              Revisar solicitudes <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
