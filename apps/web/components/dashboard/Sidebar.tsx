'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronDown,
} from 'lucide-react';
import { useState } from 'react';
import { DashboardRole } from './DashboardAuthContext';
import { canAccessDashboardPath } from '@/lib/frontend-routing';
import type { DashboardNotificationCounts } from './useDashboardNotifications';

type MenuLinkItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
};

type MenuSubmenuItem = {
  type: 'submenu';
  name: string;
  icon: typeof LayoutDashboard;
  key: string;
  items: MenuLinkItem[];
};

type MenuItem = MenuLinkItem | MenuSubmenuItem;

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const comprasYEntradasItems: MenuLinkItem[] = [
  {
    name: 'Pagos y Facturacion',
    href: '/dashboard/compras/facturacion',
    icon: Receipt,
  },
  {
    name: 'Recepcion de Lotes',
    href: '/dashboard/compras/recepcion',
    icon: Database,
  },
];

const inventarioItems: MenuLinkItem[] = [
  {
    name: 'Inventario FIFO',
    href: '/dashboard/logistica/inventario',
    icon: Package,
  },
  {
    name: 'Salidas no comerciales',
    href: '/dashboard/logistica/inventario/salidas-no-comerciales',
    icon: Package,
  },
];

function isSubmenuItem(item: MenuItem): item is MenuSubmenuItem {
  return 'type' in item && item.type === 'submenu';
}

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
      {
        type: 'submenu',
        key: 'compras-y-entradas',
        name: 'Compras y Entradas',
        icon: Database,
        items: comprasYEntradasItems,
      },
      {
        type: 'submenu',
        key: 'inventario',
        name: 'Inventario',
        icon: Package,
        items: inventarioItems,
      },
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
] satisfies MenuGroup[];

interface SidebarProps {
  user: { email?: string | null } | null;
  role: DashboardRole;
  handleLogout: () => Promise<void>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isCollapsed: boolean;
  shouldAnimate?: boolean;
  notificationCounts: DashboardNotificationCounts;
}

export default function Sidebar({
  user,
  role,
  handleLogout,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isCollapsed,
  shouldAnimate = true,
  notificationCounts,
}: SidebarProps) {
  const pathname = usePathname();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const isItemActive = (href: string) => {
    if (
      href === '/dashboard' ||
      href === '/dashboard/finanzas' ||
      href === '/dashboard/logistica/inventario'
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isSubmenuActive = (item: MenuSubmenuItem) =>
    item.items.some((child) => isItemActive(child.href));

  const getItemBadgeCount = (href: string) => notificationCounts.byHref[href] ?? 0;

  const getSubmenuBadgeCount = (item: MenuSubmenuItem) =>
    item.items.reduce((sum, child) => sum + getItemBadgeCount(child.href), 0);

  const filteredMenuGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items
        .map((item) => {
          if (!isSubmenuItem(item)) {
            return canAccessDashboardPath(role, item.href) ? item : null;
          }

          const visibleChildren = item.items.filter((child) =>
            canAccessDashboardPath(role, child.href),
          );

          if (visibleChildren.length === 0) {
            return null;
          }

          return {
            ...item,
            items: visibleChildren,
          };
        })
        .filter((item): item is MenuItem => item !== null),
    }))
    .filter((group) => group.items.length > 0);

  const renderDesktopLink = (item: MenuLinkItem, nested = false, forceExpanded = false) => {
    const isActive = isItemActive(item.href);
    const Icon = item.icon;
    const badgeCount = getItemBadgeCount(item.href);
    const showBadge = badgeCount > 0;
    const renderCollapsed = isCollapsed && !forceExpanded;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={renderCollapsed ? item.name : undefined}
        className={`group relative flex items-center rounded-xl text-sm font-bold transition-all duration-200 ${
          isActive
            ? 'bg-primary text-base-color shadow-md shadow-primary/10'
            : 'text-muted hover:bg-primary/5 hover:text-primary'
        } ${renderCollapsed ? 'justify-center gap-0 px-0 py-2.5' : nested ? 'ml-4 gap-3 px-4 py-2.5' : 'gap-3 px-4 py-2.5'}`}
      >
        <Icon
          className={`h-4 w-4 transition-colors ${
            isActive ? 'text-base-color' : 'text-muted group-hover:text-primary'
          }`}
        />
        <span
          aria-hidden={renderCollapsed}
          className={`flex min-w-0 flex-1 items-center justify-between gap-3 overflow-hidden whitespace-nowrap transition-all duration-200 ${
            renderCollapsed
              ? 'max-w-0 translate-x-1 opacity-0'
              : 'max-w-52 translate-x-0 opacity-100 delay-100'
          }`}
        >
          <span className="truncate">{item.name}</span>
          {showBadge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                isActive ? 'bg-base-color/15 text-base-color' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {badgeCount}
            </span>
          ) : null}
        </span>
        {renderCollapsed && showBadge ? (
          <span className="absolute right-2 top-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
            {badgeCount}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderMobileLink = (item: MenuLinkItem, nested = false) => {
    const active = isItemActive(item.href);
    const badgeCount = getItemBadgeCount(item.href);
    const showBadge = badgeCount > 0;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`flex items-center gap-4 rounded-2xl text-base font-bold transition-all ${
          active
            ? 'scale-[1.02] bg-primary text-base-color shadow-xl shadow-primary/10'
            : 'border border-theme bg-surface text-muted'
        } ${nested ? 'ml-4 px-4 py-3' : 'px-5 py-3.5'}`}
      >
        <item.icon className={`h-5 w-5 ${active ? 'text-base-color' : 'text-muted'}`} />
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <span className="truncate">{item.name}</span>
          {showBadge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                active ? 'bg-base-color/15 text-base-color' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {badgeCount}
            </span>
          ) : null}
        </span>
      </Link>
    );
  };

  return (
    <>
      <aside className={`fixed inset-y-0 z-20 hidden flex-col border-r border-theme bg-surface ${shouldAnimate ? 'transition-[width] duration-300 ease-in-out' : 'transition-none'} md:flex ${isCollapsed ? 'w-24' : 'w-72'}`}>
        <div className={`border-b border-theme transition-[padding] duration-300 ease-in-out ${isCollapsed ? 'p-4' : 'p-8'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xl font-black text-base-color shadow-sm transition-transform hover:rotate-3">
                T
              </div>
              <h1
                aria-hidden={isCollapsed}
                className={`overflow-hidden whitespace-nowrap text-xl font-black tracking-tight text-primary transition-all duration-200 ${
                  isCollapsed
                    ? 'max-w-0 translate-x-1 opacity-0'
                    : 'max-w-40 translate-x-0 opacity-100 delay-100'
                }`}
              >
                Tote Bag Co.
              </h1>
            </div>
          </div>
          <div
            aria-hidden={isCollapsed}
            className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ${
              isCollapsed ? 'mt-0 max-h-0 opacity-0' : 'mt-4 max-h-4 opacity-100 delay-100'
            }`}
          >
            <span className="h-px w-4 bg-accent/40"></span>
            <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Panel Admin</p>
          </div>
        </div>

        <nav className={`custom-scrollbar flex-1 overflow-y-auto transition-all duration-300 ease-in-out ${isCollapsed ? 'space-y-6 px-3 py-4' : 'space-y-8 px-4 py-6'}`}>
          {filteredMenuGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3
                aria-hidden={isCollapsed}
                className={`overflow-hidden px-4 text-[10px] font-bold uppercase tracking-widest text-muted/50 transition-all duration-200 ${
                  isCollapsed ? 'max-h-0 opacity-0' : 'max-h-4 opacity-100 delay-100'
                }`}
              >
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  if (!isSubmenuItem(item)) {
                    return renderDesktopLink(item);
                  }

                  const isActive = isSubmenuActive(item);
                  const isOpen = openSubmenus[item.key] ?? isActive;
                  const Icon = item.icon;

                  return (
                    <div key={item.key} className="relative">
                      {(() => {
                        const badgeCount = getSubmenuBadgeCount(item);
                        const showBadge = badgeCount > 0;

                        return (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenSubmenus((current) => ({
                            ...current,
                            [item.key]: !isOpen,
                          }))
                        }
                        title={isCollapsed ? item.name : undefined}
                        className={`group relative flex w-full items-center rounded-xl text-sm font-bold transition-all duration-200 ${
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted hover:bg-primary/5 hover:text-primary'
                        } ${isCollapsed ? 'justify-center gap-0 px-0 py-2.5' : 'gap-3 px-4 py-2.5'}`}
                        >
                          <Icon
                            className={`h-4 w-4 transition-colors ${
                              isActive ? 'text-primary' : 'text-muted group-hover:text-primary'
                            }`}
                          />
                          <span
                            aria-hidden={isCollapsed}
                            className={`min-w-0 flex-1 overflow-hidden truncate whitespace-nowrap text-left transition-all duration-200 ${
                              isCollapsed
                                ? 'max-w-0 translate-x-1 opacity-0'
                                : 'max-w-52 translate-x-0 opacity-100 delay-100'
                            }`}
                          >
                            {item.name}
                          </span>
                          {!isCollapsed ? (
                            <span className="flex items-center gap-2">
                              {showBadge ? (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                                  {badgeCount}
                                </span>
                              ) : null}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                  isOpen ? 'rotate-180 text-primary' : 'text-muted'
                                }`}
                              />
                            </span>
                          ) : (
                            <>
                              {showBadge ? (
                                <span className="absolute right-1.5 top-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                                  {badgeCount}
                                </span>
                              ) : null}
                              <ChevronDown
                                className={`absolute -bottom-0.5 right-1 h-3 w-3 transition-transform duration-200 ${
                                  isOpen ? 'rotate-180 text-primary' : 'text-muted'
                                }`}
                              />
                            </>
                          )}
                      </button>
                        );
                      })()}

                      {!isCollapsed && isOpen ? (
                        <div className="mt-1 space-y-1">
                          {item.items.map((child) => renderDesktopLink(child, true))}
                        </div>
                      ) : null}

                      {isCollapsed && isOpen ? (
                        <div className="absolute left-full top-0 z-30 ml-3 w-64 rounded-2xl border border-theme bg-surface p-3 shadow-2xl shadow-black/10">
                          <div className="mb-2 flex items-center gap-2 px-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                              {item.name}
                            </p>
                          </div>
                          <div className="space-y-1">
                            {item.items.map((child) => renderDesktopLink(child, false, true))}
                          </div>
                        </div>
                      ) : null}
                    </div>
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
                <div
                  aria-hidden={isCollapsed}
                  className={`flex min-w-0 flex-col overflow-hidden whitespace-nowrap transition-all duration-200 ${
                    isCollapsed
                      ? 'max-w-0 translate-x-1 opacity-0'
                      : 'max-w-40 translate-x-0 opacity-100 delay-100'
                  }`}
                >
                  <span className="truncate text-sm font-bold text-primary">
                    {user?.email?.split('@')[0] || 'Admin'}
                  </span>
                  <span className="truncate text-[10px] font-medium text-muted">{user?.email}</span>
                </div>
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
                    if (!isSubmenuItem(item)) {
                      return renderMobileLink(item);
                    }

                    const isActive = isSubmenuActive(item);
                    const isOpen = openSubmenus[item.key] ?? isActive;
                    const Icon = item.icon;

                    return (
                      <div key={item.key} className="space-y-2">
                        {(() => {
                          const badgeCount = getSubmenuBadgeCount(item);
                          const showBadge = badgeCount > 0;

                          return (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSubmenus((current) => ({
                              ...current,
                              [item.key]: !isOpen,
                            }))
                          }
                          className={`flex w-full items-center gap-4 rounded-2xl px-5 py-3.5 text-base font-bold transition-all ${
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'border border-theme bg-surface text-muted'
                          }`}
                        >
                          <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted'}`} />
                          <span className="min-w-0 flex-1 text-left">{item.name}</span>
                          <span className="flex items-center gap-2">
                            {showBadge ? (
                              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                                {badgeCount}
                              </span>
                            ) : null}
                            <ChevronDown
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isOpen ? 'rotate-180 text-primary' : 'text-muted'
                              }`}
                            />
                          </span>
                        </button>
                          );
                        })()}
                        {isOpen ? (
                          <div className="space-y-2">
                            {item.items.map((child) => renderMobileLink(child, true))}
                          </div>
                        ) : null}
                      </div>
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
