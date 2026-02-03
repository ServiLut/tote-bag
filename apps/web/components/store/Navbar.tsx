'use client';

import { useCart } from '@/context/CartContext';
import { ShoppingBag, Menu, User, Search, UserCircle, Sun, Moon, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';

export default function Navbar() {
  const { openCart, count } = useCart();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [supabase] = useState(() => createClient());
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setTimeout(() => {
        setIsLoggedIn(!!session);
        if (session) {
          // Try to get role from local storage first for speed
          const storedRole = localStorage.getItem('user_role');
          if (storedRole) {
            setUserRole(storedRole);
          } else {
             // Fallback or could fetch profile
             setUserRole('CUSTOMER'); 
          }
        }
      }, 0);
    };
    checkUser();
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (!session) {
        setUserRole(null);
        localStorage.removeItem('user_role');
      } else {
        const storedRole = localStorage.getItem('user_role');
        setUserRole(storedRole || 'CUSTOMER');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const getProfileLink = () => {
    if (!isLoggedIn) return '/login';
    if (userRole === 'ADMIN') return '/dashboard';
    return '/profile';
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-base/80 backdrop-blur-md border-b border-theme transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Mobile Menu & Search */}
            <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full md:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted">
                <Link href="/catalog" className="hover:text-primary transition-colors">Tienda</Link>
                <Link href="/b2b" className="hover:text-accent transition-colors font-bold uppercase text-[10px] tracking-widest border border-accent px-2 py-1 rounded-sm">B2B</Link>
                <Link href="/about" className="hover:text-primary transition-colors">Nosotros</Link>
              </div>
            </div>

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <Link href="/" className="text-2xl font-serif font-bold tracking-tighter text-primary transition-colors">
                TOTE BAG.
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 flex-1">
              <button className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block">
                <Search className="w-5 h-5" />
              </button>
              
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors"
                aria-label="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              <Link href={getProfileLink()} className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block">
                {isLoggedIn ? <UserCircle className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </Link>
              <button 
                onClick={openCart}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors relative group"
              >
                <ShoppingBag className="w-5 h-5" />
                {count > 0 && (
                  <span className="absolute top-1 right-0.5 w-4 h-4 bg-secondary text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-base">
                    {count}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-base md:hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-theme">
            <span className="text-xl font-serif font-bold text-primary">Menu</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-body hover:bg-primary/5 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex flex-col p-6 gap-6 text-lg font-medium text-muted overflow-y-auto">
             <Link 
               href="/catalog" 
               onClick={() => setIsMobileMenuOpen(false)} 
               className="flex items-center justify-between hover:text-primary transition-colors py-2 border-b border-theme/30"
             >
                Tienda
             </Link>
             <Link 
               href="/b2b" 
               onClick={() => setIsMobileMenuOpen(false)} 
               className="flex items-center justify-between hover:text-accent transition-colors py-2 border-b border-theme/30"
             >
                <span className="font-bold text-accent">B2B</span>
             </Link>
             <Link 
               href="/about" 
               onClick={() => setIsMobileMenuOpen(false)} 
               className="flex items-center justify-between hover:text-primary transition-colors py-2 border-b border-theme/30"
             >
                Nosotros
             </Link>
             
             <div className="mt-auto pt-8 flex flex-col gap-4">
                <Link 
                  href={getProfileLink()} 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="flex items-center gap-3 p-3 rounded-lg bg-theme/5 hover:bg-theme/10 transition-colors"
                >
                   {isLoggedIn ? <UserCircle className="w-5 h-5" /> : <User className="w-5 h-5" />}
                   {isLoggedIn ? 'Mi Perfil' : 'Iniciar Sesión'}
                </Link>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
