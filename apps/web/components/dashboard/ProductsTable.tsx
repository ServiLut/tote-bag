'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertTriangle, Check, Eye, Pencil, Trash2, X, Package, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import Image from 'next/image';
import { ApiResponse } from '@/types/api';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Variant {
  id: string;
  sku: string;
  color: string;
  stock: number;
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  collection: string | Collection;
  description?: string;
  images: ProductImage[];
  basePrice: number;
  minPrice: number;
  costPrice?: number;
  comparePrice?: number;
  status: 'DISPONIBLE' | 'BAJO_PEDIDO' | 'PREVENTA';
  variants: Variant[];
}

export default function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const supabase = createClient();

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    setRole(userRole);
  }, []);

  const isReadOnly = role === 'ADVISOR';

  const fetchProducts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/products/list`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      const responseBody: ApiResponse<Product[]> = await res.json();
      setProducts(responseBody.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, [API_URL, supabase.auth]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setProducts(prev =>
        prev.map(p => (p.id === id ? { ...p, status: newStatus as Product['status'] } : p))
      );
    } catch (err) {
      console.error(err);
      alert('Error actualizando estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });

      if (!res.ok) throw new Error('Failed to delete product');

      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error eliminando producto');
    }
  };

  const calculateMarginStatus = (base: number, cost?: number, min?: number) => {
    // 1. Profit Margin Risk (Priority)
    if (cost && base > 0) {
      const margin = ((base - cost) / base) * 100;
      if (margin < 20) return { type: 'danger', label: 'Bajo Margen', value: margin }; // < 20%
      if (margin < 35) return { type: 'warning', label: 'Margen Medio', value: margin }; // 20-35%
    }
    
    // 2. MAP Risk (Price too close to minimum)
    if (min && base < min * 1.05) {
      return { type: 'warning', label: 'Cerca del Min', value: null };
    }

    return { type: 'success', label: 'Saludable', value: null };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(val);
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-zinc-400" /></div>;
  if (error) return <div className="text-red-500 p-4 font-medium">{error}</div>;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-theme bg-surface shadow-sm">
        <table className="w-full divide-y divide-theme text-sm">
          <thead>
            <tr className="bg-base/50">
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest">Producto</th>
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest">Estado</th>
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest">Precio (PL)</th>
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest">Variantes</th>
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest text-right">Margen</th>
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {products.map((product) => {
              const status = calculateMarginStatus(product.basePrice, product.costPrice, product.minPrice);
              const firstImage = product.images?.[0]?.url;
              const mainImage = (firstImage && firstImage.trim().length > 0) ? firstImage : '/placeholder.svg';

              return (
                <tr 
                  key={product.id} 
                  className={cn(
                    "hover:bg-base/30 transition-colors group",
                    status.type === 'danger' && "bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-base border border-theme flex-shrink-0 relative shadow-sm">
                        <Image 
                          src={mainImage} 
                          alt={product.name} 
                          width={48}
                          height={48}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300" 
                        />
                      </div>
                      <div>
                        <div className="font-black text-primary tracking-tight">{product.name}</div>
                        <div className="text-[9px] text-muted font-black uppercase tracking-widest">
                          {typeof product.collection === 'object' ? product.collection.name : product.collection}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={product.status}
                        onChange={(e) => handleStatusChange(product.id, e.target.value)}
                        disabled={updatingId === product.id || isReadOnly}
                        className={cn(
                          "rounded-lg border-theme bg-surface py-1.5 pl-3 pr-8 text-[9px] font-black uppercase tracking-widest focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer disabled:opacity-50 transition-all",
                          product.status === 'DISPONIBLE' ? "text-green-700 dark:text-green-400" :
                          product.status === 'BAJO_PEDIDO' ? "text-primary" : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        <option value="DISPONIBLE">DISPONIBLE</option>
                        <option value="BAJO_PEDIDO">BAJO PEDIDO</option>
                        <option value="PREVENTA">PREVENTA</option>
                      </select>
                      {updatingId === product.id && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-primary">{formatCurrency(product.basePrice)}</div>
                    <div className="text-[10px] text-muted font-bold">MIN: {formatCurrency(product.minPrice)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {product.variants.slice(0, 3).map((v, i) => (
                        <div key={i} className="h-6 w-6 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-[8px] font-black text-base-color shadow-sm" title={v.color}>
                          {v.color.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {product.variants.length > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-surface bg-base flex items-center justify-center text-[8px] font-black text-muted shadow-sm">
                          +{product.variants.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest",
                      status.type === 'danger' ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30" :
                      status.type === 'warning' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                      "bg-secondary/10 text-secondary border-secondary/20"
                    )} title={status.label}>
                      {status.type === 'danger' ? <AlertTriangle className="w-3 h-3" /> :
                       status.type === 'warning' ? <DollarSign className="w-3 h-3" /> :
                       <Check className="w-3 h-3" />}
                      <span>
                        {status.value ? `${status.value.toFixed(0)}%` : status.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="p-2.5 text-muted hover:text-primary hover:bg-base rounded-xl transition-all active:scale-90"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {!isReadOnly && (
                        <>
                          <Link
                            href={`/dashboard/products/${product.id}/edit`}
                            className="p-2.5 text-muted hover:text-secondary hover:bg-secondary/10 rounded-xl transition-all active:scale-90"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-2.5 text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all active:scale-90"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300 relative border border-theme">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-5 right-5 p-2 bg-base/80 hover:bg-base rounded-full text-muted hover:text-primary transition-all z-10 active:scale-90"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row">
              {/* Left: Image Gallery */}
              <div className="w-full md:w-2/5 bg-base/50 p-8 flex flex-col gap-4 border-r border-theme">
                <div className="aspect-square rounded-2xl overflow-hidden bg-surface border border-theme shadow-inner relative">
                  <Image 
                    src={(selectedProduct.images?.[0]?.url && selectedProduct.images[0].url.trim().length > 0) ? selectedProduct.images[0].url : '/placeholder.svg'} 
                    alt={selectedProduct.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {selectedProduct.images.slice(1).map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-theme flex-shrink-0 relative shadow-sm">
                        <Image src={img.url || '/placeholder.svg'} alt="thumbnail" width={64} height={64} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="w-full md:w-3/5 p-10">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-secondary bg-secondary/10 px-2.5 py-1 rounded-md border border-secondary/20">
                      {typeof selectedProduct.collection === 'object' ? selectedProduct.collection.name : selectedProduct.collection}
                    </span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border",
                      selectedProduct.status === 'DISPONIBLE' ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-100 dark:border-green-900/30" :
                      selectedProduct.status === 'BAJO_PEDIDO' ? "bg-base text-primary border-theme" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:border-amber-900/30"
                    )}>
                      {selectedProduct.status}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-primary leading-tight tracking-tighter">{selectedProduct.name}</h2>
                  <p className="text-xs text-muted font-bold mt-2 font-mono tracking-wider opacity-70">/{selectedProduct.slug}</p>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" /> Público
                    </p>
                    <p className="text-xl font-black text-primary">{formatCurrency(selectedProduct.basePrice)}</p>
                  </div>
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Mínimo
                    </p>
                    <p className="text-xl font-black text-secondary">{formatCurrency(selectedProduct.minPrice)}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Variantes & Stock
                    </h3>
                    <div className="bg-surface border border-theme rounded-2xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-base/50 text-muted border-b border-theme">
                          <tr>
                            <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px]">SKU</th>
                            <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px]">Color</th>
                            <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-theme/50">
                          {selectedProduct.variants.map((v) => (
                            <tr key={v.id}>
                              <td className="px-4 py-2.5 font-mono text-muted text-[10px]">{v.sku}</td>
                              <td className="px-4 py-2.5 font-bold text-primary">{v.color}</td>
                              <td className="px-4 py-2.5 text-right font-black text-primary">{v.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedProduct.description && (
                    <div>
                      <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-2">Descripción</h3>
                      <p className="text-sm text-muted leading-relaxed font-medium">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}