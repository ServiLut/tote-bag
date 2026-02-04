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
  X
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';

const menuItems = [
  { name: 'Resumen', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Pedidos', href: '/dashboard/orders', icon: ShoppingBag },
  { name: 'Productos', href: '/dashboard/products', icon: Package },
  { name: 'Clientes', href: '/dashboard/customers', icon: Users },
  { name: 'Corporativo (B2B)', href: '/dashboard/b2b', icon: Briefcase },
];

interface SidebarProps {
  user: User | null;
  handleLogout: () => Promise<void>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export default function Sidebar({ user, handleLogout, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <>
      {/* Sidebar Desktop */}
      <aside className="hidden w-72 border-r border-theme bg-surface md:flex flex-col fixed inset-y-0 z-20 transition-colors duration-300">
        <div className="p-8 border-b border-theme">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-primary rounded-xl flex items-center justify-center text-base-color font-black text-xl shadow-sm transition-transform hover:rotate-3">
                T
              </div>
              <h1 className="text-xl font-black tracking-tight text-primary">Tote Bag Co.</h1>
            </div>
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2.5 rounded-xl bg-base border border-theme text-muted hover:text-primary hover:border-primary/30 transition-all active:scale-95 shadow-sm"
                title="Cambiar Modo"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="h-px w-4 bg-accent/40"></span>
            <p className="text-[10px] text-muted font-bold tracking-[0.2em] uppercase">Panel Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-base-color shadow-md shadow-primary/10'
                    : 'text-muted hover:bg-primary/5 hover:text-primary'
                }`}
              >
                <Icon 
                  className={`w-5 h-5 transition-colors ${
                    isActive ? 'text-base-color' : 'text-muted group-hover:text-primary'
                  }`} 
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-theme bg-base/30">
          <div className="flex items-center justify-between p-3 rounded-xl border border-theme bg-surface group shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-base-color">
                <UserCircle className="w-6 h-6" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-primary truncate">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
                <span className="text-[10px] text-muted truncate font-medium">{user?.email}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg" 
              title="Cerrar Sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-base p-6 animate-in slide-in-from-top-10 fade-in duration-200">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-base-color font-black">T</div>
              <span className="font-black text-xl tracking-tight text-primary">Menú</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2.5 bg-surface border border-theme rounded-xl text-muted active:scale-90 transition-transform">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="space-y-3">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-lg font-bold transition-all ${
                  pathname === item.href
                    ? 'bg-primary text-base-color shadow-xl shadow-primary/10 scale-[1.02]'
                    : 'bg-surface border border-theme text-muted hover:text-primary'
                }`}
              >
                <item.icon className={pathname === item.href ? 'text-base-color' : 'text-muted'} />
                {item.name}
              </Link>
            ))}
            <div className="pt-6 mt-6 border-t border-theme">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-lg font-bold text-red-600 bg-red-50 dark:bg-red-950/20 active:scale-95 transition-all"
              >
                <LogOut className="w-6 h-6" />
                Cerrar Sesión
              </button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
