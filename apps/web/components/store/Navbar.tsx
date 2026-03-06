'use client';

import { useCart } from '@/context/CartContext';
import {
  ShoppingBag,
  Menu,
  User,
  Search,
  UserCircle,
  Sun,
  Moon,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { ApiResponse } from '@/types/api';

interface SearchSuggestion {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  collection: {
    name: string;
  } | null;
  images: {
    url: string;
    alt: string | null;
  }[];
}

export default function Navbar() {
  const { openCart, count } = useCart();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [supabase] = useState(() => createClient());
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    router.prefetch('/catalog');
  }, [router]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }

      if (event.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session) {
        const storedRole = localStorage.getItem('user_role');
        setUserRole(storedRole || 'CUSTOMER');
      }
    };
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();

    if (!isSearchOpen || normalizedQuery.length < 2) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(
          `${API_URL}/catalog/search?q=${encodeURIComponent(
            normalizedQuery,
          )}&limit=6`,
          { signal: controller.signal },
        );

        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const body: ApiResponse<SearchSuggestion[]> = await res.json();
        setSuggestions(body.data || []);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [API_URL, isSearchOpen, searchQuery]);

  const getProfileLink = () => {
    if (!isLoggedIn) return '/login';
    if (userRole === 'ADMIN') return '/dashboard';
    return '/profile';
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSuggestions([]);
    setSearchLoading(false);
  };

  const handleSearchInputBlur = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;
      const isInsideOverlay = !!searchOverlayRef.current?.contains(activeElement);

      if (!isInsideOverlay && !searchQuery.trim()) {
        closeSearch();
      }
    });
  };

  const runSearch = (rawQuery: string) => {
    const normalizedQuery = rawQuery.trim();
    if (!normalizedQuery) return;

    router.push(`/catalog?search=${encodeURIComponent(normalizedQuery)}`);
    closeSearch();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(searchQuery);
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-base/80 backdrop-blur-md border-b border-theme transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div
              className={`flex items-center gap-4 flex-1 transition-all duration-500 ease-in-out ${
                isSearchOpen
                  ? 'opacity-0 -translate-x-4 pointer-events-none'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full md:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
                <Link
                  href="/catalog"
                  className="hover:text-primary transition-colors font-black uppercase text-[10px] tracking-[0.2em]"
                >
                  Tienda
                </Link>

                <Link
                  href="/personaliza"
                  className="hover:text-primary transition-colors flex items-center gap-2 uppercase text-[10px] font-black tracking-[0.2em]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  Personaliza
                </Link>
                <Link
                  href="/b2b"
                  className="hover:text-accent transition-colors font-black uppercase text-[10px] tracking-[0.2em] border border-accent/30 px-3 py-1 rounded-lg"
                >
                  B2B
                </Link>
              </div>
            </div>

            <div
              className={`flex-shrink-0 flex items-center justify-center transition-all duration-500 ease-in-out ${
                isSearchOpen
                  ? 'opacity-0 scale-95 pointer-events-none'
                  : 'opacity-100 scale-100'
              }`}
            >
              <Link
                href="/"
                className="text-2xl font-serif font-black tracking-tighter text-primary transition-all active:scale-95"
              >
                TOTE BAG.
              </Link>
            </div>

            <div
              className={`absolute inset-0 z-10 bg-base flex items-center transition-all duration-500 ease-in-out ${
                isSearchOpen
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 -translate-y-4 pointer-events-none'
              }`}
            >
              <div className="w-full max-w-4xl mx-auto px-6 sm:px-10 lg:px-12">
                <div ref={searchOverlayRef} className="relative">
                  <form onSubmit={handleSearch} className="flex items-center gap-6">
                    <Search className="w-6 h-6 text-primary/40 shrink-0" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={handleSearchInputBlur}
                      placeholder="Que estas buscando hoy?"
                      className="flex-1 bg-transparent border-none focus:ring-0 text-xl text-body placeholder:text-muted/40 font-medium py-4 px-2"
                    />
                    <button
                      type="button"
                      onClick={closeSearch}
                      className="p-2 hover:bg-primary/5 rounded-full transition-all group active:scale-90 shrink-0"
                    >
                      <X className="w-6 h-6 text-muted group-hover:text-primary transition-colors" />
                    </button>
                  </form>

                  {searchQuery.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-theme bg-surface/90  shadow-xl overflow-hidden z-20">
                      {searchLoading ? (
                        <div className="px-4 py-4 text-sm text-muted flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Buscando...
                        </div>
                      ) : suggestions.length > 0 ? (
                        <ul className="max-h-72 overflow-auto py-2">
                          {suggestions.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  router.push(`/catalog/${item.slug}`);
                                  closeSearch();
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors"
                              >
                                <p className="text-sm font-semibold text-body">
                                  {item.name}
                                </p>
                                <p className="text-xs text-muted">
                                  {item.collection?.name || 'Coleccion'}
                                </p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-4 py-4 text-sm text-muted">
                          Sin resultados para &quot;{searchQuery.trim()}&quot;
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`flex items-center justify-end gap-2 flex-1 transition-all duration-500 ${
                isSearchOpen
                  ? 'opacity-0 translate-x-4 pointer-events-none'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block"
                aria-label="Abrir busqueda (Ctrl+K)"
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors"
                aria-label="Toggle theme"
              >
                {mounted &&
                  (theme === 'dark' ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  ))}
              </button>

              <Link
                href={getProfileLink()}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block"
              >
                {isLoggedIn ? (
                  <UserCircle className="w-5 h-5" />
                ) : (
                  <User className="w-5 h-5" />
                )}
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

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-base md:hidden flex flex-col animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between p-6 border-b border-theme">
            <span className="text-xl font-serif font-black tracking-tighter text-primary">
              TOTE BAG.
            </span>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-body hover:bg-primary/5 rounded-full transition-all active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex flex-col p-8 gap-8 text-sm font-black uppercase tracking-widest text-muted overflow-y-auto">
            <Link
              href="/catalog"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors border-b border-theme/20 pb-4"
            >
              Tienda
            </Link>
            <Link
              href="/personaliza"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors border-b border-theme/20 pb-4 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-accent" /> Personaliza
            </Link>
            <Link
              href="/b2b"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-accent transition-colors border-b border-theme/20 pb-4"
            >
              B2B Corporativo
            </Link>
            <Link
              href="/about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="hover:text-primary transition-colors"
            >
              Nosotros
            </Link>

            <div className="mt-auto pt-8">
              <Link
                href={getProfileLink()}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-4 p-5 rounded-2xl bg-surface border border-theme shadow-sm transition-all active:scale-95"
              >
                {isLoggedIn ? (
                  <UserCircle className="w-6 h-6" />
                ) : (
                  <User className="w-6 h-6" />
                )}
                <span className="text-xs">
                  {isLoggedIn ? 'Mi Cuenta' : 'Iniciar Sesion'}
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
