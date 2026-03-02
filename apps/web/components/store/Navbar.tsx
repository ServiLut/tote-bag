'use client';

import { useCart } from '@/context/CartContext';
import { ShoppingBag, Menu, User, Search, UserCircle, Sun, Moon, X, Sparkles } from 'lucide-react';
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
          const storedRole = localStorage.getItem('user_role');
          setUserRole(storedRole || 'CUSTOMER');
        }
      }, 0);
    };
    checkUser();
    
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
      <nav className="sticky top-0 z-40 w-full bg-base/80 backdrop-blur-md border-b border-theme transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Nav Links */}
            <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full md:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
                <Link href="/catalog" className="hover:text-primary transition-colors font-black uppercase text-[10px] tracking-[0.2em]">Tienda</Link>
                
                <Link href="/personaliza" className="hover:text-primary transition-colors flex items-center gap-2 uppercase text-[10px] font-black tracking-[0.2em]">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Personaliza
                </Link>
                <Link href="/b2b" className="hover:text-accent transition-colors font-black uppercase text-[10px] tracking-[0.2em] border border-accent/30 px-3 py-1 rounded-lg">B2B</Link>
              </div>
            </div>

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <Link href="/" className="text-2xl font-serif font-black tracking-tighter text-primary transition-all active:scale-95">
                TOTE BAG.
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 flex-1">
              <button className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block">
                <Search className="w-5 h-5" />
              </button>
              
              <button 
                onClick={toggleTheme}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors"
                aria-label="Toggle theme"
              >
                {mounted && (theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
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
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-base">
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
        <div className="fixed inset-0 z-50 bg-base md:hidden flex flex-col animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between p-6 border-b border-theme">
            <span className="text-xl font-serif font-black tracking-tighter text-primary">TOTE BAG.</span>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-body hover:bg-primary/5 rounded-full transition-all active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex flex-col p-8 gap-8 text-sm font-black uppercase tracking-widest text-muted overflow-y-auto">
             <Link href="/catalog" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors border-b border-theme/20 pb-4">Tienda</Link>
             <Link href="/personaliza" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors border-b border-theme/20 pb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" /> Personaliza
             </Link>
             <Link href="/b2b" onClick={() => setIsMobileMenuOpen(false)} className="text-accent transition-colors border-b border-theme/20 pb-4">B2B Corporativo</Link>
             <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors">Nosotros</Link>
             
             <div className="mt-auto pt-8">
                <Link 
                  href={getProfileLink()} 
                  onClick={() => setIsMobileMenuOpen(false)} 
                  className="flex items-center gap-4 p-5 rounded-2xl bg-surface border border-theme shadow-sm transition-all active:scale-95"
                >
                   {isLoggedIn ? <UserCircle className="w-6 h-6" /> : <User className="w-6 h-6" />}
                   <span className="text-xs">{isLoggedIn ? 'Mi Cuenta' : 'Iniciar Sesión'}</span>
                </Link>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
