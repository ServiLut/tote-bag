'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Briefcase,
  LogOut,
  UserCircle,
  Users,
  Sun,
  Moon,
  X,
  ShieldCheck,
  Settings,
  DollarSign,
  Truck,
  Database,
  Calculator,
  Receipt,
  BarChart3,
  FileText,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { DashboardRole } from './DashboardAuthContext';

const menuGroups = [
  {
    title: 'GENERAL',
    items: [
      { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Pedidos', href: '/dashboard/orders', icon: ShoppingBag },
      { name: 'Productos', href: '/dashboard/products', icon: Package },
      { name: 'Clientes', href: '/dashboard/customers', icon: Users },
      { name: 'Corporativo (B2B)', href: '/dashboard/b2b', icon: Briefcase },
    ],
  },
  {
    title: 'FINANZAS',
    items: [
      { name: 'Dashboard Financiero', href: '/dashboard/finanzas', icon: BarChart3 },
      { name: 'Flujo de Caja', href: '/dashboard/finance/cash-flow', icon: DollarSign },
      { name: 'Gastos Operativos', href: '/dashboard/finance/opex', icon: Receipt },
    ],
  },
  {
    title: 'COMPRAS Y LOGISTICA',
    items: [
      { name: 'Proveedores de Envio', href: '/dashboard/logistica/proveedores', icon: Truck },
      { name: 'Gestion de Envios', href: '/dashboard/logistica/envios', icon: Package },
      { name: 'Proveedores Insumos', href: '/dashboard/logistics/suppliers', icon: Truck },
      { name: 'Recepcion de Lotes', href: '/dashboard/compras/recepcion', icon: Database },
      { name: 'Inventario FIFO', href: '/dashboard/logistics/inventory', icon: Package },
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
}

export default function Sidebar({
  user,
  role,
  handleLogout,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const isItemActive = (href: string) => {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const filteredMenuGroups = menuGroups.filter((group) => {
    if (role === 'MANAGER') {
      return group.title !== 'FINANZAS' && group.title !== 'SISTEMA';
    }

    return true;
  });

  return (
    <>
      <aside className="fixed inset-y-0 z-20 hidden w-72 flex-col border-r border-theme bg-surface transition-colors duration-300 md:flex">
        <div className="border-b border-theme p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xl font-black text-base-color shadow-sm transition-transform hover:rotate-3">
                T
              </div>
              <h1 className="text-xl font-black tracking-tight text-primary">Tote Bag Co.</h1>
            </div>
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-xl border border-theme bg-base p-2.5 text-muted shadow-sm transition-all hover:border-primary/30 hover:text-primary active:scale-95"
                title="Cambiar modo"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-px w-4 bg-accent/40"></span>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Panel Admin</p>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-8 overflow-y-auto px-4 py-6">
          {filteredMenuGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="px-4 text-[10px] font-bold uppercase tracking-widest text-muted/50">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isItemActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-base-color shadow-md shadow-primary/10'
                          : 'text-muted hover:bg-primary/5 hover:text-primary'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 transition-colors ${
                          isActive ? 'text-base-color' : 'text-muted group-hover:text-primary'
                        }`}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-theme bg-base/30 p-4">
          <div className="group flex items-center justify-between rounded-xl border border-theme bg-surface p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base-color">
                <UserCircle className="h-6 w-6" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-primary">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
                <span className="truncate text-[10px] font-medium text-muted">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              title="Cerrar sesion"
            >
              <LogOut className="h-4 w-4" />
            </button>
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
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-bold transition-all ${
                        isItemActive(item.href)
                          ? 'scale-[1.02] bg-primary text-base-color shadow-xl shadow-primary/10'
                          : 'border border-theme bg-surface text-muted'
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isItemActive(item.href) ? 'text-base-color' : 'text-muted'}`}
                      />
                      {item.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-6 border-t border-theme pt-6">
              <button
                onClick={handleLogout}
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
