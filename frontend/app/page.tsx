'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/store/Navbar';
import ProductCard from '@/components/store/ProductCard';
import CartDrawer from '@/components/store/CartDrawer';
import Footer from '@/components/store/Footer';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/products/list`);
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
    <div className="min-h-screen flex flex-col bg-base transition-colors duration-300">
      <Navbar />
      <CartDrawer />

      {/* Hero Section */}
      <section className="relative w-full h-[80vh] bg-base flex items-center justify-center overflow-hidden transition-colors duration-300">
        <div className="absolute inset-0 z-0 opacity-10">
           <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/linen.png')] dark:invert"></div>
        </div>
        
        <div className="relative z-10 text-center space-y-6 max-w-2xl px-4">
          <span className="text-secondary font-bold tracking-widest uppercase text-sm">Colección 2026</span>
          <h1 className="text-5xl md:text-7xl font-serif text-primary leading-tight">
            Menos plástico, <br/> más estilo.
          </h1>
          <p className="text-lg text-muted max-w-lg mx-auto">
            Bolsos artesanales hechos con algodón 100% orgánico. Diseñados para durar, creados para el planeta.
          </p>
          <div className="pt-4 flex gap-4 justify-center">
            <Link href="/catalog" className="px-8 py-3 btn-primary font-medium rounded-sm uppercase tracking-wider text-xs">
              Ver Colección
            </Link>
            <Link href="/about" className="px-8 py-3 btn-outline font-medium rounded-sm uppercase tracking-wider text-xs">
              Nuestra Historia
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-end mb-12 border-b border-theme pb-6">
          <div>
            <h2 className="text-3xl font-serif text-primary mb-2 uppercase tracking-tight">Nuestros Favoritos</h2>
            <p className="text-muted text-sm">Piezas atemporales gestionadas desde nuestro catálogo.</p>
          </div>
          <Link href="/catalog" className="hidden sm:block text-primary font-bold uppercase text-xs tracking-widest hover:text-accent transition-colors">
            Ver catálogo completo &rarr;
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
            No hay productos disponibles en este momento.
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
              Ver catálogo completo
            </Link>
          </div>
        )}
      </section>

      {/* Banner Sostenibilidad */}
      <section className="bg-secondary text-white py-24 px-4 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <span className="text-white/70 font-bold tracking-[0.2em] uppercase text-xs">Compromiso Real</span>
          <h2 className="text-4xl md:text-5xl font-serif leading-tight">Moda Consciente, Impacto Real.</h2>
          <p className="text-lg opacity-90 max-w-2xl mx-auto font-light leading-relaxed">
            Cada tote bag ahorra un promedio de 500 bolsas plásticas al año. Trabajamos con artesanos locales y materiales certificados bajo estándares éticos.
          </p>
          <div className="pt-4">
            <button className="px-10 py-4 border border-white/30 hover:bg-white hover:text-secondary transition-all rounded-sm text-sm uppercase font-bold tracking-widest">
              Saber más
            </button>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
