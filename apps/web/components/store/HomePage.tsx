'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ProductCard from '@/components/store/ProductCard';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchProducts = async () => {
      try {
        const res = await apiFetch('/catalog/products?limit=4');

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null) as
            | { message?: string }
            | null;

          if (!isCancelled) {
            setError(
              typeof errorBody?.message === 'string' && errorBody.message.trim().length > 0
                ? errorBody.message
                : t('home_products_unavailable'),
            );
          }

          return;
        }

        const responseBody: ApiResponse<Product[]> = await res.json();

        if (!isCancelled) {
          setProducts(Array.isArray(responseBody.data) ? responseBody.data : []);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : t('home_products_unavailable'),
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void fetchProducts();

    return () => {
      isCancelled = true;
    };
  }, [t]);

  const sellingPaths = [
    {
      href: '/catalog',
      title: t('home_path_shop_title'),
      description: t('home_path_shop_description'),
      cta: t('home_path_shop_cta'),
    },
    {
      href: '/personaliza',
      title: t('home_path_customize_title'),
      description: t('home_path_customize_description'),
      cta: t('home_path_customize_cta'),
    },
    {
      href: '/b2b',
      title: t('home_path_b2b_title'),
      description: t('home_path_b2b_description'),
      cta: t('home_path_b2b_cta'),
    },
  ];

  return (
    <>
      <section className="relative w-full overflow-hidden bg-base px-4 py-20 transition-colors duration-300 md:py-28">
        <div className="absolute inset-0 z-0 opacity-10">
          <div className="h-full w-full bg-[url('https://www.transparenttextures.com/patterns/linen.png')]" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center text-center">
          <button
            onClick={toggleLanguage}
            className="mb-6 rounded-full border border-primary/30 px-3 py-1 text-xs hover:bg-primary/10 transition-colors"
          >
            {t('home_language_toggle')}
          </button>
          <span className="text-secondary font-bold tracking-widest uppercase text-sm">
            {t('home_paths_badge')}
          </span>
          <h1 className="mt-5 text-5xl md:text-7xl font-serif text-primary leading-tight">
            {t('home_hero_primary_line_1')} <br /> {t('home_hero_primary_line_2')}
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-muted">
            {t('home_hero_subtitle')}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href="/catalog" className="px-8 py-3 btn-primary font-medium rounded-sm uppercase tracking-wider text-xs">
              {t('shop_stock')}
            </Link>
            <Link href="/personaliza" className="px-8 py-3 btn-outline font-medium rounded-sm uppercase tracking-wider text-xs">
              {t('home_customize_cta')}
            </Link>
            <Link href="/b2b" className="px-8 py-3 border border-accent text-accent hover:bg-accent hover:text-white transition-colors font-medium rounded-sm uppercase tracking-wider text-xs">
              {t('home_b2b_cta')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-3">
        {sellingPaths.map((path) => (
          <div key={path.href} className="rounded-[2rem] border border-theme bg-surface p-6 shadow-sm">
            <h2 className="text-2xl font-serif text-primary">{path.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{path.description}</p>
            <Link
              href={path.href}
              className="mt-6 inline-flex text-sm font-bold text-primary underline underline-offset-4"
            >
              {path.cta}
            </Link>
          </div>
        ))}
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-12 border-b border-theme pb-6">
          <div>
            <h2 className="text-3xl font-serif text-primary mb-2 uppercase tracking-tight">{t('featured_selection')}</h2>
            <p className="text-muted text-sm">{t('featured_description')}</p>
          </div>
          <Link href="/lineas" className="hidden sm:block text-primary font-bold uppercase text-xs tracking-widest hover:text-accent transition-colors">
            {t('explore_lines')} &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : error ? (
          <div className="py-20 text-center text-accent font-medium">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-theme bg-surface py-16 text-center text-muted">
            {t('no_products')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showVariantIndicator={false}
              />
            ))}
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="mt-16 text-center sm:hidden">
            <Link href="/catalog" className="text-primary font-bold uppercase text-xs tracking-widest border-b-2 border-primary pb-1">
              {t('view_all_catalog')}
            </Link>
          </div>
        )}
      </section>

      <section className="bg-secondary text-white py-24 px-4 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-white/70 font-bold tracking-[0.2em] uppercase text-xs">{t('home_commitment_badge')}</span>
          <h2 className="text-4xl md:text-5xl font-serif leading-tight">{t('home_commitment_title')}</h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto font-light leading-relaxed">
            {t('home_commitment_description')}
          </p>
          <div className="pt-4">
            <Link href="/beneficios" className="inline-block px-10 py-4 border border-white/30 hover:bg-white hover:text-secondary transition-all rounded-sm text-sm uppercase font-bold tracking-widest">
              {t('learn_more')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
