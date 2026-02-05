'use client';

import { useRouter } from 'next/navigation';
import { 
  Menu,
  Loader2,
  Sun,
  Moon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { useTheme } from 'next-themes';
import Sidebar from '@/components/dashboard/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { theme, setTheme } = useTheme();

  // Handle hydration
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const userRole = localStorage.getItem('user_role');
      
      if (userRole !== 'ADMIN' && userRole !== 'ADVISOR' && userRole !== 'VIEWER') {
        router.push('/catalog');
        return;
      }

      setLoading(false);
    };

    checkUser();
  }, [router, supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_role');
    router.refresh();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-base">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-base text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300 dashboard-bg-custom">
      <Sidebar 
        user={user} 
        handleLogout={handleLogout} 
        isMobileMenuOpen={isMobileMenuOpen} 
        setIsMobileMenuOpen={setIsMobileMenuOpen} 
      />

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen bg-base">
        {/* Mobile Header */}
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
  );
}