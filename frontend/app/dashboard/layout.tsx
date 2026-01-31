'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Briefcase, 
  LogOut,
  Menu,
  UserCircle,
  Loader2,
  Users
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

const menuItems = [
  { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/dashboard/orders', icon: ShoppingBag },
  { name: 'Productos', href: '/dashboard/products', icon: Package },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users },
  { name: 'Corporativo (B2B)', href: '/dashboard/b2b', icon: Briefcase },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Check for admin role in user metadata (or fetch profile if needed)
      // For now we check the metadata we'll set on login or just redirect if not authorized
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // We should ideally fetch the profile to be sure about the role
      // But as a quick win, we can assume the user needs to be logged in 
      // and we can add a check against a specific flag or the backend response
      const userRole = localStorage.getItem('user_role');
      
      if (userRole !== 'ADMIN') {
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
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar Desktop */}
      <aside className="hidden w-72 border-r border-zinc-200 bg-white md:flex flex-col fixed inset-y-0 z-20">
        <div className="p-8 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-black rounded-lg flex items-center justify-center text-white font-bold text-lg">
              T
            </div>
            <h1 className="text-xl font-bold tracking-tight">Tote Bag Co.</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-2 font-medium tracking-wide uppercase">Panel de Administración</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-100 text-black shadow-sm'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-black'
                }`}
              >
                <Icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-black' : 'text-zinc-400 group-hover:text-black'
                  }`} 
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <UserCircle className="w-9 h-9 text-zinc-400" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-zinc-900 truncate max-w-[120px]">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
                <span className="text-xs text-zinc-500 truncate max-w-[120px]">{user?.email}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-600 transition-colors p-1" 
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 flex flex-col min-h-screen bg-zinc-50/50">
        {/* Mobile Header */}
        <div className="md:hidden bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-black rounded-md flex items-center justify-center text-white font-bold text-sm">
              T
            </div>
            <span className="font-bold tracking-tight">Tote Bag Co.</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-6 h-6 text-zinc-600" />
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-white p-6 animate-in slide-in-from-top-10 fade-in duration-200">
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold text-lg">Menú</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-zinc-100 rounded-full">
                <LogOut className="w-5 h-5 rotate-180" />
              </button>
            </div>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium bg-zinc-50 text-zinc-900"
                >
                  <item.icon className="w-6 h-6" />
                  {item.name}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-lg font-medium text-red-600 hover:bg-red-50 mt-4"
              >
                <LogOut className="w-6 h-6" />
                Cerrar Sesión
              </button>
            </nav>
          </div>
        )}
        
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
