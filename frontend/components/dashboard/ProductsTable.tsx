'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/products/list`);
      if (!res.ok) throw new Error('Failed to fetch products');
      const responseBody: ApiResponse<Product[]> = await res.json();
      setProducts(responseBody.data);
    } catch (err) {
      console.error(err);
      setError('Error cargando productos');
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
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
      const res = await fetch(`${API_URL}/products/${id}`, {
        method: 'DELETE',
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
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full divide-y divide-zinc-200 text-sm">
          <thead>
            <tr className="bg-zinc-50/50">
              <th className="px-6 py-4 text-left font-semibold text-zinc-900">Producto</th>
              <th className="px-6 py-4 text-left font-semibold text-zinc-900">Estado</th>
              <th className="px-6 py-4 text-left font-semibold text-zinc-900">Precio (PL)</th>
              <th className="px-6 py-4 text-left font-semibold text-zinc-900">Variantes</th>
              <th className="px-6 py-4 text-left font-semibold text-zinc-900 text-right">Margen</th>
              <th className="px-6 py-4 text-right font-semibold text-zinc-900">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {products.map((product) => {
              const status = calculateMarginStatus(product.basePrice, product.costPrice, product.minPrice);
              const firstImage = product.images?.[0]?.url;
              const mainImage = (firstImage && firstImage.trim().length > 0) ? firstImage : '/placeholder.svg';

              return (
                <tr 
                  key={product.id} 
                  className={cn(
                    "hover:bg-zinc-50/80 transition-colors group",
                    status.type === 'danger' && "bg-red-50/30 hover:bg-red-50/50"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0 relative">
                        <Image 
                          src={mainImage} 
                          alt={product.name} 
                          width={48}
                          height={48}
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300" 
                        />
                      </div>
                      <div>
                        <div className="font-bold text-zinc-900 tracking-tight">{product.name}</div>
                        <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
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
                        disabled={updatingId === product.id}
                        className={cn(
                          "rounded-lg border-zinc-200 py-1.5 pl-3 pr-8 text-xs font-bold uppercase tracking-wide focus:ring-2 focus:ring-black outline-none appearance-none cursor-pointer disabled:opacity-50",
                          product.status === 'DISPONIBLE' ? "bg-green-50 text-green-700 border-green-100" :
                          product.status === 'BAJO_PEDIDO' ? "bg-zinc-100 text-zinc-700" : "bg-amber-50 text-amber-700 border-amber-100"
                        )}
                      >
                        <option value="DISPONIBLE">DISPONIBLE</option>
                        <option value="BAJO_PEDIDO">BAJO PEDIDO</option>
                        <option value="PREVENTA">PREVENTA</option>
                      </select>
                      {updatingId === product.id && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-zinc-900">{formatCurrency(product.basePrice)}</div>
                    <div className="text-[10px] text-zinc-400 font-medium">MIN: {formatCurrency(product.minPrice)}</div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600">
                    <div className="flex -space-x-2">
                      {product.variants.slice(0, 3).map((v, i) => (
                        <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center text-[10px] font-bold" title={v.color}>
                          {v.color.charAt(0)}
                        </div>
                      ))}
                      {product.variants.length > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                          +{product.variants.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md border",
                      status.type === 'danger' ? "bg-red-50 text-red-700 border-red-100" :
                      status.type === 'warning' ? "bg-amber-50 text-amber-700 border-amber-100" :
                      "bg-green-50 text-green-700 border-green-100"
                    )} title={status.label}>
                      {status.type === 'danger' ? <AlertTriangle className="w-3 h-3" /> :
                       status.type === 'warning' ? <DollarSign className="w-3 h-3" /> :
                       <Check className="w-3 h-3" />}
                      <span className="font-bold text-[10px] uppercase">
                        {status.value ? `${status.value.toFixed(0)}%` : status.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/dashboard/products/${product.id}/edit`}
                        className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10 zoom-in-95 duration-200 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 bg-white/80 hover:bg-zinc-100 rounded-full text-zinc-500 hover:text-black transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col md:flex-row">
              {/* Left: Image Gallery (Simple) */}
              <div className="w-full md:w-2/5 bg-zinc-50 p-6 flex flex-col gap-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-white border border-zinc-100 shadow-sm relative">
                  <Image 
                    src={(selectedProduct.images?.[0]?.url && selectedProduct.images[0].url.trim().length > 0) ? selectedProduct.images[0].url : '/placeholder.svg'} 
                    alt={selectedProduct.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Thumbnails if multiple */}
                {selectedProduct.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedProduct.images.slice(1).map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-200 flex-shrink-0 relative">
                        <Image 
                          src={img.url || '/placeholder.svg'} 
                          alt={`${selectedProduct.name} thumbnail ${i + 1}`}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Details */}
              <div className="w-full md:w-3/5 p-8">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      {typeof selectedProduct.collection === 'object' ? selectedProduct.collection.name : selectedProduct.collection}
                    </span>
                    <span className={cn(
                      "text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md",
                      selectedProduct.status === 'DISPONIBLE' ? "bg-green-50 text-green-700" :
                      selectedProduct.status === 'BAJO_PEDIDO' ? "bg-zinc-100 text-zinc-700" : "bg-amber-50 text-amber-700"
                    )}>
                      {selectedProduct.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-zinc-900 leading-tight">{selectedProduct.name}</h2>
                  <p className="text-sm text-zinc-500 font-mono mt-1">/{selectedProduct.slug}</p>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-xs text-zinc-500 font-medium mb-1 flex items-center gap-1">
                      <DollarSign className="w-3 h-3" /> Precio Público
                    </p>
                    <p className="text-lg font-bold text-zinc-900">{formatCurrency(selectedProduct.basePrice)}</p>
                  </div>
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                    <p className="text-xs text-zinc-500 font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Precio Mínimo
                    </p>
                    <p className="text-lg font-bold text-zinc-700">{formatCurrency(selectedProduct.minPrice)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Variantes & Stock
                    </h3>
                    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-zinc-50 text-zinc-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">SKU</th>
                            <th className="px-3 py-2 font-medium">Color</th>
                            <th className="px-3 py-2 font-medium text-right">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {selectedProduct.variants.map((v) => (
                            <tr key={v.id}>
                              <td className="px-3 py-2 font-mono text-zinc-600">{v.sku}</td>
                              <td className="px-3 py-2 font-medium text-zinc-900">{v.color}</td>
                              <td className="px-3 py-2 text-right font-medium">{v.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedProduct.description && (
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 mb-1">Descripción</h3>
                      <p className="text-sm text-zinc-600 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-100">
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