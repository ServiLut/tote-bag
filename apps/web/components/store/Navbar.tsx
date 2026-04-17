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
  Settings,
  MapPin,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { useTheme } from '@/components/theme-provider';
import { useRouter } from 'next/navigation';
import { ApiResponse } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { getProfileNavigationPath } from '@/lib/frontend-routing';
import { apiFetch } from '@/utils/api';
import { DashboardRoleSwitcher } from '@/components/dashboard/DashboardRoleSwitcher';
import { normalizeDashboardRole } from '@/lib/dashboard-auth';

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
  const { t } = useTranslation();
  const { openCart, count } = useCart();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [debugRoleAllowed, setDebugRoleAllowed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [supabase] = useState(() => createClient());
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const resolvedRole = normalizeDashboardRole(userRole);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session) {
        const sessionEmail = session.user.email || '';
        setProfileEmail(sessionEmail);

        try {
          const res = await apiFetch('/profiles/me', {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          if (res.ok) {
            const body = await res.json();
            const profile = body.data || body;
            const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
            const apiRole =
              normalizeDashboardRole(profile?.user?.role) ??
              normalizeDashboardRole(profile?.role);
            setUserRole(apiRole || 'CUSTOMER');
            setDebugRoleAllowed(profile?.debugRoleAllowed === true);
            setProfileName(fullName || sessionEmail);
          } else {
            const storedRole = localStorage.getItem('user_role');
            setUserRole(storedRole || 'CUSTOMER');
            setDebugRoleAllowed(false);
            setProfileName(sessionEmail);
          }
        } catch {
          const storedRole = localStorage.getItem('user_role');
          setUserRole(storedRole || 'CUSTOMER');
          setDebugRoleAllowed(false);
          setProfileName(sessionEmail);
        }
      } else {
        setProfileEmail('');
        setProfileName('');
        setDebugRoleAllowed(false);
      }
    };
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
      setIsLoggedIn(!!session);
      setIsProfileMenuOpen(false);
      if (!session) {
        setUserRole(null);
        setProfileEmail('');
        setProfileName('');
        setDebugRoleAllowed(false);
        localStorage.removeItem('user_role');
      } else {
        const storedRole = localStorage.getItem('user_role');
        const sessionEmail = session.user.email || '';
        setUserRole(storedRole || 'CUSTOMER');
        setDebugRoleAllowed(false);
        setProfileEmail(sessionEmail);
        setProfileName(sessionEmail);
      }
      },
    );

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
        const res = await apiFetch(
          `/catalog/search?q=${encodeURIComponent(normalizedQuery)}&limit=6`,
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
  }, [isSearchOpen, searchQuery]);

  const getProfileLink = () => {
    if (!isLoggedIn) return '/login';
    return getProfileNavigationPath(userRole as
      | 'ADMIN'
      | 'MANAGER'
      | 'CUSTOMER'
      | null);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user_role');
    setIsProfileMenuOpen(false);
    router.push('/login');
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
            <div className={`flex items-center gap-4 flex-1 transition-all duration-500 ease-in-out ${
              isSearchOpen ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}>
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full md:hidden transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted">
                <Link href="/catalog" className="hover:text-primary transition-colors font-black uppercase text-[10px] tracking-[0.2em]">
                  {t('nav_shop')}
                </Link>
                <Link href="/personaliza" className="hover:text-primary transition-colors flex items-center gap-2 uppercase text-[10px] font-black tracking-[0.2em]">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  {t('nav_customize')}
                </Link>
                <Link href="/b2b" className="hover:text-accent transition-colors font-black uppercase text-[10px] tracking-[0.2em] border border-accent/30 px-3 py-1 rounded-lg">
                  B2B
                </Link>
              </div>
            </div>

            <div className={`flex-shrink-0 flex items-center justify-center transition-all duration-500 ease-in-out ${
              isSearchOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
            }`}>
              <Link href="/" className="text-2xl font-serif font-black tracking-tighter text-primary transition-all active:scale-95">
                {t('navbar_brand')}
              </Link>
            </div>

            <div className={`absolute inset-0 z-10 bg-base flex items-center transition-all duration-500 ease-in-out ${
              isSearchOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}>
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
                      placeholder={t('nav_search_placeholder')}
                      className="flex-1 bg-white/35 border border-theme/30 focus:border-primary/20 focus:ring-0 text-xl text-body placeholder:text-muted/40 font-medium py-4 px-4 rounded-2xl outline-none"
                    />
                    <button type="button" onClick={closeSearch} className="p-2 hover:bg-primary/5 rounded-full transition-all group active:scale-90 shrink-0">
                      <X className="w-6 h-6 text-muted group-hover:text-primary transition-colors" />
                    </button>
                  </form>

                  {searchQuery.trim().length >= 2 && (
                    <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-theme bg-surface/90 shadow-xl overflow-hidden z-20">
                      {searchLoading ? (
                        <div className="px-4 py-4 text-sm text-muted flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('nav_searching')}
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
                                <p className="text-sm font-semibold text-body">{item.name}</p>
                                <p className="text-xs text-muted">{item.collection?.name || t('navbar_collection_fallback')}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="px-4 py-4 text-sm text-muted">
                          {t('navbar_no_results', { query: searchQuery.trim() })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-2 flex-1 transition-all duration-500 ${
              isSearchOpen ? 'opacity-0 translate-x-4 pointer-events-none' : 'opacity-100 translate-x-0'
            }`}>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors hidden sm:block"
                aria-label={t('navbar_search_aria')}
              >
                <Search className="w-5 h-5" />
              </button>

              <button
                onClick={toggleTheme}
                className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors"
                aria-label={t('nav_toggle_theme')}
              >
                {mounted && (theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
              </button>

              <div className="relative hidden sm:block" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((current) => !current)}
                  className="flex items-center gap-1 rounded-full p-2 text-body transition-colors hover:bg-primary/5"
                  aria-label={isLoggedIn ? t('nav_my_account') : t('nav_sign_in')}
                >
                  {isLoggedIn ? <UserCircle className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-64 rounded-2xl border border-theme bg-surface p-2 shadow-xl">
                    {isLoggedIn ? (
                      <>
                        <div className="border-b border-theme px-3 py-3">
                          <p className="truncate text-sm font-bold text-primary">{profileName || profileEmail}</p>
                          <p className="truncate text-xs text-muted">{profileEmail}</p>
                        </div>
                        <Link
                          href="/profile?panel=settings"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="mt-2 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-base"
                        >
                          <Settings className="h-4 w-4 text-accent" />
                          Configuracion
                        </Link>
                        <Link
                          href="/profile?panel=addresses"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-base"
                        >
                          <MapPin className="h-4 w-4 text-accent" />
                          Direcciones
                        </Link>
                        <Link
                          href={getProfileLink()}
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-base"
                        >
                          <UserCircle className="h-4 w-4 text-accent" />
                          Mi cuenta
                        </Link>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          {t('profile_logout')}
                        </button>
                        {resolvedRole ? (
                          <div className="mt-2 px-1 pb-1">
                            <DashboardRoleSwitcher
                              role={resolvedRole}
                              accessToken={null}
                              debugRoleAllowed={debugRoleAllowed}
                            />
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-base"
                        >
                          <User className="h-4 w-4 text-accent" />
                          Ingresar
                        </Link>
                        <Link
                          href="/register"
                          onClick={() => setIsProfileMenuOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-base"
                        >
                          <Sparkles className="h-4 w-4 text-accent" />
                          Registrarse
                        </Link>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <button onClick={openCart} className="p-2 text-body hover:bg-primary/5 rounded-full transition-colors relative group">
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
            <span className="text-xl font-serif font-black tracking-tighter text-primary">{t('navbar_brand')}</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-body hover:bg-primary/5 rounded-full transition-all active:scale-90">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex flex-col p-8 gap-8 text-sm font-black uppercase tracking-widest text-muted overflow-y-auto">
            <Link href="/catalog" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors border-b border-theme/20 pb-4">
              {t('nav_shop')}
            </Link>
            <Link href="/personaliza" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors border-b border-theme/20 pb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> {t('nav_customize')}
            </Link>
            <Link href="/b2b" onClick={() => setIsMobileMenuOpen(false)} className="text-accent transition-colors border-b border-theme/20 pb-4">
              {t('nav_b2b_corporate')}
            </Link>
            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-primary transition-colors">
              {t('nav_about')}
            </Link>

            <div className="mt-auto pt-8">
              {isLoggedIn ? (
                <div className="space-y-3 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
                  <div>
                    <p className="text-sm font-bold text-primary">{profileName || profileEmail}</p>
                    <p className="truncate text-[10px] text-muted">{profileEmail}</p>
                  </div>
                  <Link
                    href="/profile?panel=settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-base"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-xs">Configuracion</span>
                  </Link>
                  <Link
                    href="/profile?panel=addresses"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-base"
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-xs">Direcciones</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await handleLogout();
                    }}
                    className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left text-red-600 transition-colors hover:bg-red-50"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-xs">{t('profile_logout')}</span>
                  </button>
                  {resolvedRole ? (
                    <DashboardRoleSwitcher
                      role={resolvedRole}
                      accessToken={null}
                      debugRoleAllowed={debugRoleAllowed}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-surface border border-theme shadow-sm transition-all active:scale-95"
                  >
                    <User className="w-6 h-6" />
                    <span className="text-xs">Ingresar</span>
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-4 p-5 rounded-2xl bg-surface border border-theme shadow-sm transition-all active:scale-95"
                  >
                    <Sparkles className="w-6 h-6 text-accent" />
                    <span className="text-xs">Registrarse</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
