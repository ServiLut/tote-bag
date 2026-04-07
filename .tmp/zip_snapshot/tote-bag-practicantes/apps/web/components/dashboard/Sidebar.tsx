'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Briefcase,
  Sparkles,
  LogOut,
  UserCircle,
  Users,
  X,
  ShieldCheck,
  Settings,
  DollarSign,
  Truck,
  Database,
  Calculator,
  Receipt,
  Wallet,
  BarChart3,
  FileText,
  Inbox,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';
import { DashboardRole } from './DashboardAuthContext';
import { canAccessDashboardPath } from '@/lib/frontend-routing';

const menuGroups = [
  {
    title: 'GENERAL',
    items: [
      { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Pedidos', href: '/dashboard/orders', icon: ShoppingBag },
      { name: 'Productos', href: '/dashboard/products', icon: Package },
      { name: 'Clientes', href: '/dashboard/customers', icon: Users },
      { name: 'Corporativo (B2B)', href: '/dashboard/b2b', icon: Briefcase },
      { name: 'Personalizaciones', href: '/dashboard/personalizaciones', icon: Sparkles },
      { name: 'PQRS', href: '/dashboard/pqrs', icon: Inbox },
    ],
  },
  {
    title: 'FINANZAS',
    items: [
      { name: 'Dashboard Financiero', href: '/dashboard/finanzas', icon: BarChart3 },
      { name: 'Flujo de Caja', href: '/dashboard/finanzas/cash-flow', icon: DollarSign },
      { name: 'Gastos Operativos', href: '/dashboard/finanzas/opex', icon: Receipt },
      { name: 'Nomina', href: '/dashboard/finanzas/nomina', icon: Wallet },
    ],
  },
  {
    title: 'COMPRAS Y LOGISTICA',
    items: [
      { name: 'Proveedores de Envio', href: '/dashboard/logistica/proveedores', icon: Truck },
      { name: 'Gestion de Envios', href: '/dashboard/logistica/envios', icon: Package },
      { name: 'Proveedores Insumos', href: '/dashboard/logistica/insumos', icon: Truck },
      { name: 'Recepcion de Lotes', href: '/dashboard/compras/recepcion', icon: Database },
      { name: 'Inventario FIFO', href: '/dashboard/logistica/inventario', icon: Package },
    ],
  },
  {
    title: 'ESTRATEGIA',
    items: [
      { name: 'Precios y Margenes', href: '/dashboard/strategy/pricing', icon: Calculator },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { name: 'Reportes Contables', href: '/dashboard/reportes', icon: FileText },
      { name: 'Auditoria', href: '/dashboard/audit', icon: ShieldCheck },
      { name: 'Configuracion', href: '/dashboard/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  user: { email?: string | null } | null;
  role: DashboardRole;
  handleLogout: () => Promise<void>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
}

export default function Sidebar({
  user,
  role,
  handleLogout,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const [newPqrsCount, setNewPqrsCount] = useState(0);
  const supabase = createClient();
  const canAccessPqrs = canAccessDashboardPath(role, '/dashboard/pqrs');

  const isItemActive = (href: string) => {
    if (href === '/dashboard' || href === '/dashboard/finanzas') {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const loadPqrsCount = useCallback(async () => {
    if (!canAccessPqrs) {
      setNewPqrsCount(0);
      return;
    }

    try {
      const headers = await getAuthHeaders();

      if (!headers.Authorization) {
        setNewPqrsCount(0);
        return;
      }

      const response = await apiFetch('/pqrs?status=NUEVO', {
        headers,
      });

      if (!response.ok) {
        setNewPqrsCount(0);
        return;
      }

      const body = await response.json();
      const tickets = body.data || body || [];
      setNewPqrsCount(Array.isArray(tickets) ? tickets.length : 0);
    } catch (error) {
      console.error('Error loading PQRS count:', error);
      setNewPqrsCount(0);
    }
  }, [canAccessPqrs]);

  useEffect(() => {
    const triggerLoad = () => {
      void loadPqrsCount();
    };

    const timeoutId = window.setTimeout(triggerLoad, 0);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerLoad();
      }
    }, 15000);

    window.addEventListener('focus', triggerLoad);
    document.addEventListener('visibilitychange', triggerLoad);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', triggerLoad);
      document.removeEventListener('visibilitychange', triggerLoad);
    };
  }, [loadPqrsCount]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token) {
          setNewPqrsCount(0);
          return;
        }

        void loadPqrsCount();
      },
    );

    const intervalId = window.setInterval(() => {
      void loadPqrsCount();
    }, 30000);

    const handleWindowFocus = () => {
      void loadPqrsCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadPqrsCount();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadPqrsCount, supabase.auth]);

  const filteredMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessDashboardPath(role, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <aside className={`fixed inset-y-0 z-20 hidden flex-col border-r border-theme bg-surface transition-[width] duration-300 md:flex ${isCollapsed ? 'w-24' : 'w-72'}`}>
        <div className={`border-b border-theme ${isCollapsed ? 'p-4' : 'p-8'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xl font-black text-base-color shadow-sm transition-transform hover:rotate-3">
                T
              </div>
              {!isCollapsed ? (
                <h1 className="text-xl font-black tracking-tight text-primary">Tote Bag Co.</h1>
              ) : null}
            </div>
          </div>
          {!isCollapsed ? (
            <div className="mt-4 flex items-center gap-2">
              <span className="h-px w-4 bg-accent/40"></span>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Panel Admin</p>
            </div>
          ) : null}
        </div>

        <nav className={`custom-scrollbar flex-1 overflow-y-auto ${isCollapsed ? 'space-y-6 px-3 py-4' : 'space-y-8 px-4 py-6'}`}>
          {filteredMenuGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              {!isCollapsed ? (
                <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted/50">
                  {group.title}
                </h3>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isItemActive(item.href);
                  const Icon = item.icon;
                  const showPqrsBadge = item.href === '/dashboard/pqrs' && newPqrsCount > 0;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={isCollapsed ? item.name : undefined}
                      className={`group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-base-color shadow-md shadow-primary/10'
                          : 'text-muted hover:bg-primary/5 hover:text-primary'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`h-4 w-4 transition-colors ${
                          isActive ? 'text-base-color' : 'text-muted group-hover:text-primary'
                        }`}
                      />
                      {!isCollapsed ? (
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="truncate">{item.name}</span>
                          {showPqrsBadge ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                isActive
                                  ? 'bg-base-color/15 text-base-color'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {newPqrsCount}
                            </span>
                          ) : null}
                        </span>
                      ) : showPqrsBadge ? (
                        <span className="absolute right-2 top-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                          {newPqrsCount}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-theme bg-base/30 p-4">
          <div className={`group rounded-xl border border-theme bg-surface shadow-sm ${isCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`flex ${isCollapsed ? 'justify-center' : 'items-center justify-between'} gap-3`}>
              <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base-color">
                <UserCircle className="h-6 w-6" />
              </div>
              {!isCollapsed ? (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold text-primary">
                    {user?.email?.split('@')[0] || 'Admin'}
                  </span>
                  <span className="truncate text-[10px] font-medium text-muted">{user?.email}</span>
                </div>
              ) : null}
              </div>
              <button
                onClick={() => {
                  void handleLogout();
                }}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                title="Cerrar sesion"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-base p-6 animate-in slide-in-from-top-10 fade-in duration-200 md:hidden">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-black text-base-color">
                T
              </div>
              <span className="text-xl font-black tracking-tight text-primary">Menu</span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-xl border border-theme bg-surface p-2.5 text-muted transition-transform active:scale-90"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="custom-scrollbar max-h-[70vh] space-y-6 overflow-y-auto pr-2">
            {filteredMenuGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="px-2 text-[10px] font-bold uppercase tracking-widest text-muted/50">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.items.map((item) => {
                    const active = isItemActive(item.href);
                    const showPqrsBadge = item.href === '/dashboard/pqrs' && newPqrsCount > 0;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-bold transition-all ${
                          active
                            ? 'scale-[1.02] bg-primary text-base-color shadow-xl shadow-primary/10'
                            : 'border border-theme bg-surface text-muted'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 ${active ? 'text-base-color' : 'text-muted'}`}
                        />
                        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="truncate">{item.name}</span>
                          {showPqrsBadge ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                active
                                  ? 'bg-base-color/15 text-base-color'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {newPqrsCount}
                            </span>
                          ) : null}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-6 border-t border-theme pt-6">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  void handleLogout();
                }}
                className="w-full rounded-2xl bg-red-50 px-5 py-4 text-lg font-bold text-red-600 transition-all active:scale-95 dark:bg-red-950/20"
              >
                <span className="flex items-center gap-4">
                  <LogOut className="h-6 w-6" />
                  Cerrar sesion
                </span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
