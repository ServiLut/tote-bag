'use client';

import { useRouter } from 'next/navigation';
import { Menu, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import Sidebar from '@/components/dashboard/Sidebar';
import { DashboardAuthProvider, type DashboardRole } from '@/components/dashboard/DashboardAuthContext';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  userEmail?: string | null;
  role: DashboardRole;
}

export default function DashboardLayoutClient({
  children,
  userEmail,
  role,
}: DashboardLayoutClientProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  return (
    <DashboardAuthProvider role={role}>
      <div className="flex h-screen bg-base text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 dashboard-bg-custom">
        <Sidebar
          user={{ email: userEmail }}
          handleLogout={handleLogout}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />

        <main className="flex-1 md:ml-72 flex flex-col min-h-screen bg-base">
          <div className="md:hidden bg-surface/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-black dark:bg-white rounded-md flex items-center justify-center text-white dark:text-black font-bold text-sm">
                T
              </div>
              <span className="font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Tote Bag Co.</span>
            </div>
            <div className="flex items-center gap-2">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                >
                  {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              )}
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-base">
            {children}
          </div>
        </main>
      </div>
    </DashboardAuthProvider>
  );
}
