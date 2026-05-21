'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { ThemeProvider, useTheme } from '@/components/theme-provider';
import Sidebar, {
  DASHBOARD_NAVIGATION_SEARCH_ITEMS,
} from '@/components/dashboard/Sidebar';
import { DashboardAuthProvider, type DashboardRole } from '@/components/dashboard/DashboardAuthContext';
import { DashboardRoleSwitcher } from '@/components/dashboard/DashboardRoleSwitcher';
import { DASHBOARD_DEBUG_ROLE_COOKIE_NAME } from '@/lib/dashboard-auth';
import {
  canAccessDashboardPath,
  resolveDashboardLayoutRedirect,
} from '@/lib/frontend-routing';
import { useDashboardNotifications } from '@/components/dashboard/useDashboardNotifications';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  userEmail?: string | null;
  role: DashboardRole;
  debugRoleAllowed: boolean;
  accessToken: string | null;
}

export default function DashboardLayoutClient({
  children,
  userEmail,
  role,
  debugRoleAllowed,
  accessToken,
}: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasLoadedSidebarPreference, setHasLoadedSidebarPreference] = useState(false);
  const supabase = createClient();
  const accessRedirect = resolveDashboardLayoutRedirect({
    hasSession: !!accessToken,
    role,
    pathname,
  });

  useEffect(() => {
    if (accessRedirect) {
      router.replace(accessRedirect);
    }
  }, [accessRedirect, router]);

  useEffect(() => {
    document.body.classList.add('dashboard-route');

    return () => {
      document.body.classList.remove('dashboard-route');
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const persistedValue =
      window.localStorage.getItem('dashboard-sidebar-collapsed') === 'true';
    setIsSidebarCollapsed(persistedValue);
    setHasLoadedSidebarPreference(true);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !hasLoadedSidebarPreference) {
      return;
    }

    window.localStorage.setItem(
      'dashboard-sidebar-collapsed',
      isSidebarCollapsed ? 'true' : 'false',
    );
  }, [hasLoadedSidebarPreference, isSidebarCollapsed, mounted]);

  const handleLogout = async () => {
    let clientError: unknown = null;
    let serverError: unknown = null;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        clientError = error;
      }

      const response = await fetch('/auth/signout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        serverError = new Error(`Logout route responded with ${response.status}`);
      }
    } finally {
      window.localStorage.removeItem('user_role');
      window.document.cookie = `${DASHBOARD_DEBUG_ROLE_COOKIE_NAME}=; path=/; Max-Age=0; SameSite=Lax`;

      if (clientError) {
        console.error('Error signing out from dashboard client:', clientError);
      }

      if (serverError) {
        console.error('Error signing out from dashboard server:', serverError);
      }

      window.location.replace('/login');
    }
  };

  if (accessRedirect) {
    return null;
  }

  return (
    <DashboardAuthProvider role={role} accessToken={accessToken}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <DashboardLayoutFrame
          userEmail={userEmail}
          role={role}
          debugRoleAllowed={debugRoleAllowed}
          accessToken={accessToken}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          hasLoadedSidebarPreference={hasLoadedSidebarPreference}
          mounted={mounted}
          handleLogout={handleLogout}
        >
          {children}
        </DashboardLayoutFrame>
      </ThemeProvider>
    </DashboardAuthProvider>
  );
}

interface DashboardLayoutFrameProps {
  children: React.ReactNode;
  userEmail?: string | null;
  role: DashboardRole;
  debugRoleAllowed: boolean;
  accessToken: string | null;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  hasLoadedSidebarPreference: boolean;
  mounted: boolean;
  handleLogout: () => Promise<void>;
}

type DashboardNotificationItem = {
  href: string;
  label: string;
  count: number;
};

const DASHBOARD_NOTIFICATION_META: Array<{
  href: string;
  label: string;
}> = [
  { href: '/dashboard/orders', label: 'Pedidos pendientes de pago' },
  { href: '/dashboard/b2b', label: 'Cotizaciones B2B pendientes' },
  { href: '/dashboard/personalizaciones', label: 'Solicitudes de personalizacion pendientes' },
  { href: '/dashboard/pqrs', label: 'PQRS nuevas' },
  { href: '/dashboard/logistica/envios', label: 'Envios pendientes' },
];

function NotificationMenuButton({
  items,
  total,
  status,
  errorMessage,
  desktop = false,
}: {
  items: DashboardNotificationItem[];
  total: number;
  status: 'idle' | 'ready' | 'error';
  errorMessage: string | null;
  desktop?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasNotifications = total > 0;
  const hasLoadError = status === 'error';
  const hasAttentionState = hasNotifications || hasLoadError;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={
          desktop
            ? `relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-base shadow-sm transition-all active:scale-95 ${
                hasLoadError
                  ? 'border-amber-200 text-amber-600 hover:border-amber-300 dark:border-amber-900/60 dark:text-amber-300'
                  : hasNotifications
                  ? 'border-rose-200 text-rose-600 hover:border-rose-300 dark:border-rose-900/60 dark:text-rose-300'
                  : 'border-theme text-muted hover:border-primary/30 hover:text-primary'
              }`
            : `relative rounded-lg p-2 ${
                hasLoadError
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-300'
                  : hasNotifications
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                  : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
              }`
        }
        title={
          hasLoadError
            ? 'No se pudieron actualizar las notificaciones'
            : hasNotifications
              ? `Notificaciones pendientes: ${total}`
              : 'Notificaciones'
        }
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {hasLoadError ? (
          <AlertTriangle className={desktop ? 'h-5 w-5' : 'w-5 h-5'} />
        ) : (
          <Bell className={desktop ? 'h-5 w-5' : 'w-5 h-5'} />
        )}
        {hasAttentionState ? (
          <span
            className={
              desktop
                ? `absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    hasLoadError
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                  }`
                : `absolute -right-1 -top-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                    hasLoadError
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-200'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-200'
                  }`
            }
          >
            {hasLoadError ? '!' : total}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={
            desktop
              ? 'absolute right-0 top-[calc(100%+0.75rem)] z-30 w-80 rounded-[24px] border border-theme bg-surface p-3 shadow-2xl shadow-black/10'
              : 'absolute right-0 top-[calc(100%+0.5rem)] z-30 w-72 rounded-[22px] border border-theme bg-surface p-3 shadow-2xl shadow-black/10'
          }
        >
          <div className={desktop ? 'mb-3 flex items-center justify-between gap-3 px-2' : 'px-2'}>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                Notificaciones
              </p>
              {desktop ? (
                <p className="mt-1 text-sm font-bold text-primary">
                  {hasLoadError
                    ? 'No pudimos sincronizar este panel'
                    : hasNotifications
                      ? `${total} pendientes por revisar`
                      : 'Sin pendientes'}
                </p>
              ) : null}
            </div>
            {desktop && hasAttentionState ? (
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-black ${
                  hasLoadError
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-200'
                }`}
              >
                {hasLoadError ? 'Error' : total}
              </span>
            ) : null}
          </div>

          <div className="mt-3 space-y-2">
            {hasLoadError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                {errorMessage ?? 'No se pudieron cargar las notificaciones del dashboard.'}
              </div>
            ) : null}
            {items.length > 0 ? (
              items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <span className="min-w-0 truncate">{item.label}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
                    {item.count}
                  </span>
                </Link>
              ))
            ) : (
              <div
                className={
                  desktop
                    ? 'rounded-2xl border border-dashed border-theme px-4 py-5 text-center text-sm font-medium text-muted'
                    : 'rounded-2xl border border-dashed border-theme px-4 py-4 text-center text-sm font-medium text-muted'
                }
              >
                {hasLoadError
                  ? 'No hay datos confiables para mostrar en este momento.'
                  : 'No hay notificaciones pendientes.'}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardLayoutFrame({
  children,
  userEmail,
  role,
  debugRoleAllowed,
  accessToken,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  hasLoadedSidebarPreference,
  mounted,
  handleLogout,
}: DashboardLayoutFrameProps) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const notificationCounts = useDashboardNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLFormElement | null>(null);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchableModules = DASHBOARD_NAVIGATION_SEARCH_ITEMS.filter((item) =>
    canAccessDashboardPath(role, item.href),
  );
  const searchResults = normalizedSearchQuery
    ? searchableModules.filter((item) => {
        const haystack = [
          item.label,
          item.href,
          ...item.keywords,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearchQuery);
      })
    : [];
  const notificationItems = DASHBOARD_NOTIFICATION_META
    .map<DashboardNotificationItem>((item) => ({
      ...item,
      count: notificationCounts.byHref[item.href] ?? 0,
    }))
    .filter((item) => item.count > 0);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedSearchQuery) {
      setSearchFeedback('Escribe el nombre del modulo que quieres abrir.');
      setIsSearchOpen(true);
      return;
    }

    const nextMatch = searchResults[0] ?? null;

    if (!nextMatch) {
      setSearchFeedback('No hay modulos del dashboard que coincidan con esa busqueda.');
      setIsSearchOpen(true);
      return;
    }

    setSearchFeedback(null);
    setSearchQuery('');
    setIsSearchOpen(false);
    router.push(nextMatch.href);
  };

  const handleSearchSelection = (href: string) => {
    setSearchFeedback(null);
    setSearchQuery('');
    setIsSearchOpen(false);
    router.push(href);
  };

  return (
      <div className="flex h-screen bg-base text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 dashboard-bg-custom">
        <Sidebar
          user={{ email: userEmail }}
          role={role}
          handleLogout={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isCollapsed={isSidebarCollapsed}
          shouldAnimate={hasLoadedSidebarPreference}
          notificationCounts={notificationCounts}
        />

        <main className={`flex-1 flex min-h-screen flex-col bg-base ${hasLoadedSidebarPreference ? 'transition-[margin] duration-300 ease-in-out' : 'transition-none'} ${isSidebarCollapsed ? 'md:ml-24' : 'md:ml-72'}`}>
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-surface/85 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/85">
            <div className="hidden items-center justify-between gap-6 px-6 py-4 md:flex">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <button
                  onClick={() => setIsSidebarCollapsed((current) => !current)}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-theme bg-base text-muted shadow-sm transition-all hover:border-primary/30 hover:text-primary active:scale-95"
                  title={isSidebarCollapsed ? 'Expandir sidebar' : 'Contraer sidebar'}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </button>
                <form
                  ref={searchContainerRef}
                  onSubmit={handleSearchSubmit}
                  className="relative max-w-xl flex-1"
                >
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchFeedback(null);
                      setIsSearchOpen(true);
                    }}
                    onFocus={() => setIsSearchOpen(true)}
                    placeholder="Buscar modulos del dashboard..."
                    className="h-14 w-full rounded-2xl border border-theme bg-base pl-14 pr-5 text-sm font-medium text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/15 dark:text-zinc-100"
                  />
                  {isSearchOpen && (normalizedSearchQuery || searchFeedback) ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-[24px] border border-theme bg-surface p-3 shadow-2xl shadow-black/10">
                      <div className="mb-2 px-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                          Busqueda de modulos
                        </p>
                        <p className="mt-1 text-sm font-medium text-muted">
                          Presiona Enter para abrir el mejor resultado.
                        </p>
                      </div>

                      {searchFeedback ? (
                        <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                          {searchFeedback}
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        {searchResults.length > 0 ? (
                          searchResults.slice(0, 6).map((item) => (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => handleSearchSelection(item.href)}
                              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-theme bg-base px-4 py-3 text-left text-sm font-bold text-primary transition-all hover:border-primary/20 hover:bg-primary/5"
                            >
                              <span className="min-w-0 truncate">{item.label}</span>
                              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted">
                                {item.href.replace('/dashboard/', '') || 'dashboard'}
                              </span>
                            </button>
                          ))
                        ) : normalizedSearchQuery ? (
                          <div className="rounded-2xl border border-dashed border-theme px-4 py-5 text-center text-sm font-medium text-muted">
                            No se encontraron modulos para &quot;{searchQuery.trim()}&quot;.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </form>
              </div>

              <div className="flex items-center gap-3">
                <NotificationMenuButton
                  items={notificationItems}
                  total={notificationCounts.total}
                  status={notificationCounts.status}
                  errorMessage={notificationCounts.errorMessage}
                  desktop
                />
                {notificationCounts.status === 'error' ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    Notificaciones no disponibles
                  </div>
                ) : null}
                {mounted ? (
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border border-theme bg-base text-muted shadow-sm transition-all hover:border-primary/30 hover:text-primary active:scale-95"
                    title="Cambiar modo"
                  >
                    {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </button>
                ) : null}
                <div className="flex items-center gap-3">
                  <div className="flex h-14 items-center gap-3 rounded-2xl border border-theme bg-base px-4 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base-color">
                      <UserCircle className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-primary">
                        {userEmail?.split('@')[0] || 'Admin'}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                        {role}
                      </p>
                    </div>
                  </div>
                  <DashboardRoleSwitcher
                    role={role}
                    accessToken={accessToken}
                    debugRoleAllowed={debugRoleAllowed}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 md:hidden">
              <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-black dark:bg-white rounded-md flex items-center justify-center text-white dark:text-black font-bold text-sm">
                T
              </div>
              <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Tote Bag Co.</span>
              </div>
              <div className="flex items-center gap-2">
                <NotificationMenuButton
                  items={notificationItems}
                  total={notificationCounts.total}
                  status={notificationCounts.status}
                  errorMessage={notificationCounts.errorMessage}
                />
                {mounted && (
                  <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="rounded-lg bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                )}
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                  <Menu className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-base">
            {children}
          </div>
        </main>
      </div>
  );
}
