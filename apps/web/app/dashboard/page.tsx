import Link from 'next/link';
import { ArrowRight, TrendingUp, AlertTriangle, Briefcase, ShoppingBag, Package } from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { createClient } from '@/utils/supabase/server';

interface DashboardStats {
  dailyProduction: number;
  lowStockCount: number;
  pendingQuotes: number;
}

function isDashboardStats(value: unknown): value is DashboardStats {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.dailyProduction === 'number' &&
    typeof candidate.lowStockCount === 'number' &&
    typeof candidate.pendingQuotes === 'number'
  );
}

async function getDashboardStats() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const headers = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined;

    const statsRes = await fetch(`${API_URL}/dashboard/stats`, {
      cache: 'no-store',
      headers,
    });

    if (statsRes.status === 401 || statsRes.status === 403) {
      return {
        dailyProduction: 0,
        lowStockCount: 0,
        pendingQuotes: 0,
      };
    }

    if (!statsRes.ok) {
      throw new Error(`Dashboard stats request failed with status ${statsRes.status}`);
    }

    const statsBody = (await statsRes.json()) as ApiResponse<DashboardStats> | DashboardStats;
    const payload =
      'data' in statsBody ? (statsBody as ApiResponse<DashboardStats>).data : statsBody;

    if (!isDashboardStats(payload)) {
      throw new Error('Invalid dashboard stats response');
    }

    return payload;
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
          <h1 className="text-3xl font-black tracking-tight text-primary">Resumen Diario</h1>
          <p className="text-muted mt-1 text-sm font-medium">Vista general de operaciones y alertas.</p>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-sm font-bold text-primary">{new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota' })}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: Producción */}
        <div className="group bg-surface p-6 rounded-2xl shadow-sm border border-theme transition-all duration-300 hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform duration-300">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <span className="flex items-center text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 mr-1" />
              +12%
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Pedidos Hoy</p>
            <h3 className="text-4xl font-black text-primary tracking-tight">{stats.dailyProduction}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-theme">
            <Link href="/dashboard/orders" className="text-sm text-muted font-bold flex items-center hover:text-primary transition-colors group-hover:translate-x-1">
              Ver detalle de producción <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Card 2: Inventario */}
        <div className="group bg-surface p-6 rounded-2xl shadow-sm border border-theme transition-all duration-300 hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
              <Package className="w-6 h-6" />
            </div>
            {stats.lowStockCount > 0 && (
              <span className="flex items-center text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-full animate-pulse">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Atención
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Stock Crítico</p>
            <h3 className="text-4xl font-black text-primary tracking-tight">{stats.lowStockCount}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-theme">
            <Link href="/dashboard/products" className="text-sm text-muted font-bold flex items-center hover:text-primary transition-colors group-hover:translate-x-1">
              Gestionar inventario <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Card 3: B2B */}
        <div className="group bg-surface p-6 rounded-2xl shadow-sm border border-theme transition-all duration-300 hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary/10 rounded-xl text-secondary group-hover:scale-110 transition-transform duration-300">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Cotizaciones B2B</p>
            <h3 className="text-4xl font-black text-primary tracking-tight">{stats.pendingQuotes}</h3>
          </div>
          <div className="mt-6 pt-4 border-t border-theme">
            <Link href="/dashboard/b2b" className="text-sm text-muted font-bold flex items-center hover:text-primary transition-colors group-hover:translate-x-1">
              Revisar solicitudes <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
