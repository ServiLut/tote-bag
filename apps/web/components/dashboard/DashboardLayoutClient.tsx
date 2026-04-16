'use client';

import { Menu, Sun, Moon, Bell, PanelLeftClose, PanelLeftOpen, Search, UserCircle } from 'lucide-react';
import { useState, useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import Sidebar from '@/components/dashboard/Sidebar';
import { DashboardAuthProvider, type DashboardRole } from '@/components/dashboard/DashboardAuthContext';
import { DashboardRoleSwitcher } from '@/components/dashboard/DashboardRoleSwitcher';
import { DASHBOARD_DEBUG_ROLE_COOKIE_NAME } from '@/lib/dashboard-auth';
import { resolveDashboardLayoutRedirect } from '@/lib/frontend-routing';

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
  const { theme, setTheme } = useTheme();
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
      <div className="flex h-screen bg-base text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 dashboard-bg-custom">
        <Sidebar
          user={{ email: userEmail }}
          role={role}
          handleLogout={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          isCollapsed={isSidebarCollapsed}
          shouldAnimate={hasLoadedSidebarPreference}
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
                <div className="relative max-w-xl flex-1">
                  <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar pedidos, clientes, productos o modulos..."
                    className="h-14 w-full rounded-2xl border border-theme bg-base pl-14 pr-5 text-sm font-medium text-zinc-700 outline-none transition-all placeholder:text-zinc-400 focus:border-primary/30 focus:ring-2 focus:ring-primary/15 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-theme bg-base text-muted shadow-sm transition-all hover:border-primary/30 hover:text-primary active:scale-95"
                  title="Notificaciones"
                  aria-label="Notificaciones"
                >
                  <Bell className="h-5 w-5" />
                </button>
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
                <button
                  className="rounded-lg bg-zinc-100 p-2 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300"
                  title="Notificaciones"
                  aria-label="Notificaciones"
                >
                  <Bell className="w-5 h-5" />
                </button>
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
    </DashboardAuthProvider>
  );
}
