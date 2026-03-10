'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/store/ProductCard';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/catalog/products`);
        if (!res.ok) throw new Error('Error al cargar productos');
        const responseBody: ApiResponse<Product[]> = await res.json();
        setProducts(responseBody.data);
      } catch (err) {
        console.error(err);
        setError('No pudimos cargar los productos en este momento.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL]);

  return (
    <>
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] bg-base flex items-center justify-center overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 z-0 opacity-10">
           <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/linen.png')] dark:invert"></div>
        </div>
        
        <div className="relative z-10 text-center space-y-6 max-w-2xl px-4">
          <button 
            onClick={toggleLanguage}
            className="mb-4 px-3 py-1 text-xs border border-primary/30 rounded-full hover:bg-primary/10 transition-colors"
          >
            {i18n.language === 'es' ? 'English' : 'Español'}
          </button>
          <br />
          <span className="text-secondary font-bold tracking-widest uppercase text-sm">{t('welcome')} - 2026</span>
          <h1 className="text-5xl md:text-7xl font-serif text-primary leading-tight">
            Marca Dual: <br/> Stock y Producción.
          </h1>
          <p className="text-lg text-muted max-w-lg mx-auto">
            {t('description')}
          </p>
          <div className="pt-4 flex gap-4 justify-center">
            <Link href="/catalog" className="px-8 py-3 btn-primary font-medium rounded-sm uppercase tracking-wider text-xs">
              {t('shop_stock')}
            </Link>
            <Link href="/corporativo" className="px-8 py-3 btn-outline font-medium rounded-sm uppercase tracking-wider text-xs">
              {t('corporate_area')}
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
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
          <div className="py-20 text-center text-muted">
            {t('no_products')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
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

      {/* Banner Sostenibilidad */}
      <section className="bg-secondary text-white py-24 px-4 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-white/70 font-bold tracking-[0.2em] uppercase text-xs">{t('sustainability_commitment')}</span>
          <h2 className="text-4xl md:text-5xl font-serif leading-tight">{t('conscious_fashion')}</h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto font-light leading-relaxed">
            {t('sustainability_description')}
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
