'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';
import { Loader2, AlertTriangle, Check, Eye, Pencil, Trash2, X, Package, DollarSign, Database } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';
import Image from 'next/image';
import { ApiResponse } from '@/types/api';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { apiFetch } from '@/utils/api';
import { isDashboardReadOnlyRole } from '@/lib/frontend-routing';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Variant {
  id: string;
  sku: string;
  size?: string;
  color: string;
  stock: number;
  salePrice?: number | null;
  netSalePrice?: number | null;
  netPrice?: number | null;
  taxAmount?: number | null;
  marginPercentage?: number | null;
  taxRate?: number | string | null;
  minPrice?: number | null;
  costPrice?: number | null;
  comparePrice?: number | null;
  isActive?: boolean;
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

interface Attribute {
  id: string;
  type: 'SIZE' | 'MATERIAL' | 'QUALITY' | 'LINE';
  value: string;
  priceModifier: number;
}

interface PricingRule {
  id: string;
  scope: 'B2C' | 'B2B';
  minQty: number;
  discountPct?: number;
  fixedUnitPrice?: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  collection: string | Collection;
  description?: string;
  images?: ProductImage[] | null;
  basePrice: number;
  minPrice: number;
  costPrice?: number;
  comparePrice?: number;
  status: 'DISPONIBLE' | 'BAJO_PEDIDO' | 'PREVENTA';
  variants?: Variant[] | null;
  attributes?: Attribute[] | null;
  pricingRules?: PricingRule[] | null;
}

function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function getReferenceVariant(variants: Variant[]) {
  const activeVariants = variants.filter((variant) => variant.isActive !== false);
  return activeVariants
    .filter((variant) => typeof variant.salePrice === 'number')
    .sort((left, right) => (left.salePrice ?? 0) - (right.salePrice ?? 0))[0]
    || activeVariants[0]
    || variants[0]
    || null;
}

function formatProductStatus(status: Product['status']) {
  const labels: Record<Product['status'], string> = {
    DISPONIBLE: 'Disponible',
    BAJO_PEDIDO: 'Bajo pedido',
    PREVENTA: 'Preventa',
  };

  return labels[status] ?? status;
}

export default function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { role } = useDashboardAuth();

  const supabase = createClient();

  const isReadOnly = isDashboardReadOnlyRole(role);

  const fetchProducts = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await apiFetch('/catalog/admin/products', {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });

      if (res.status === 401 || res.status === 403) {
        setProducts([]);
        return;
      }

      if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`);

      const responseBody: ApiResponse<Product[]> = await res.json();
      setProducts(responseBody.data);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [supabase.auth]);

  useEffect(() => {
    void fetchProducts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token) {
          setProducts([]);
          setLoading(false);
          return;
        }

        void fetchProducts();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProducts, supabase.auth]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await apiFetch(`/catalog/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.status === 401 || res.status === 403) {
        alert('No tienes permisos para actualizar este producto.');
        return;
      }

      if (!res.ok) throw new Error(`Failed to update status (${res.status})`);

      setProducts(prev =>
        prev.map(p => (p.id === id ? { ...p, status: newStatus as Product['status'] } : p))
      );
    } catch (err) {
      console.error('Error updating product status:', err);
      alert('Error al actualizar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await apiFetch(`/catalog/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (res.status === 401 || res.status === 403) {
        alert('No tienes permisos para eliminar este producto.');
        return;
      }

      if (!res.ok) {
        let errorMessage = `Failed to delete product (${res.status})`;

        try {
          const body = await res.json() as {
            message?: string;
            error?: string;
          };
          errorMessage = body.message || body.error || errorMessage;
        } catch {
          const fallbackText = await res.text().catch(() => '');
          if (fallbackText.trim()) {
            errorMessage = fallbackText.trim();
          }
        }

        throw new Error(errorMessage);
      }

      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting product:', err);
      const message =
        err instanceof Error ? err.message : 'Error al eliminar el producto';
      alert(message);
    }
  };

  const getMarginStatus = (marginPercentage?: number | null) => {
    if (marginPercentage === null || marginPercentage === undefined) {
      return { type: 'muted', label: 'Pendiente', value: null };
    }

    if (marginPercentage < 20) {
      return { type: 'danger', label: 'Bajo margen', value: marginPercentage };
    }

    if (marginPercentage < 35) {
      return { type: 'warning', label: 'Margen medio', value: marginPercentage };
    }

    return { type: 'success', label: 'Saludable', value: marginPercentage };
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatOptionalCurrency = (val?: number | null) => {
    return typeof val === 'number' && Number.isFinite(val)
      ? formatCurrency(val)
      : 'Pendiente';
  };

  const formatOptionalPercentage = (val?: number | null) => {
    return typeof val === 'number' && Number.isFinite(val)
      ? `${val.toFixed(2)}%`
      : 'Pendiente';
  };

  const formatTaxRate = (val?: number | string | null) =>
    val === null || val === undefined ? '0.19' : String(val);

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
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Costo unitario</th>
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">PVP con IVA</th>
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Venta neta</th>
              <th className="px-6 py-4 text-left font-bold text-primary uppercase text-[10px] tracking-widest">Variantes</th>
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Margen bruto</th>
              <th className="px-6 py-4 text-right font-bold text-primary uppercase text-[10px] tracking-widest">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {products.map((product) => {
              const productImages = ensureArray(product.images);
              const productVariants = ensureArray(product.variants);
              const referenceVariant = getReferenceVariant(productVariants);
              const referenceSalePrice =
                referenceVariant?.salePrice ?? product.basePrice;
              const referenceCostPrice =
                referenceVariant?.costPrice ?? product.costPrice;
              const referenceNetPrice = referenceVariant?.netPrice ?? null;
              const referenceTaxAmount = referenceVariant?.taxAmount ?? null;
              const referenceTaxRate = referenceVariant?.taxRate;
              const referenceMarginPercentage =
                referenceVariant?.marginPercentage ?? null;
              const status = getMarginStatus(referenceMarginPercentage);
              const firstImage = productImages[0]?.url;
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
                        <option value="DISPONIBLE">Disponible</option>
                        <option value="BAJO_PEDIDO">Bajo pedido</option>
                        <option value="PREVENTA">Preventa</option>
                      </select>
                      {updatingId === product.id && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-primary">{formatOptionalCurrency(referenceCostPrice)}</div>
                    <div className="text-[10px] text-muted font-bold">Costo inventario</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-primary">{formatCurrency(referenceSalePrice)}</div>
                    <div className="text-[10px] text-muted font-bold">IVA incluido</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-black text-secondary">{formatOptionalCurrency(referenceNetPrice)}</div>
                    <div className="text-[10px] text-muted font-bold">
                      IVA: {formatOptionalCurrency(referenceTaxAmount)} / tarifa {formatTaxRate(referenceTaxRate)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {productVariants.slice(0, 3).map((v, i) => (
                        <div key={i} className="h-6 w-6 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-[8px] font-black text-base-color shadow-sm" title={v.color}>
                          {v.color.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {productVariants.length > 3 && (
                        <div className="h-6 w-6 rounded-full border-2 border-surface bg-base flex items-center justify-center text-[8px] font-black text-muted shadow-sm">
                          +{productVariants.length - 3}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[9px] font-black uppercase tracking-widest",
                      status.type === 'danger' ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/30" :
                      status.type === 'warning' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30" :
                      status.type === 'muted' ? "bg-base text-muted border-theme" :
                      "bg-secondary/10 text-secondary border-secondary/20"
                    )} title={status.label}>
                      {status.type === 'danger' ? <AlertTriangle className="w-3 h-3" /> :
                       status.type === 'warning' ? <DollarSign className="w-3 h-3" /> :
                       <Check className="w-3 h-3" />}
                      <span>
                        {status.value !== null ? formatOptionalPercentage(status.value) : status.label}
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
        (() => {
          const selectedImages = ensureArray(selectedProduct.images);
          const selectedVariants = ensureArray(selectedProduct.variants);
          const selectedAttributes = ensureArray(selectedProduct.attributes);
          const selectedPricingRules = ensureArray(selectedProduct.pricingRules);
          const selectedReferenceVariant = getReferenceVariant(selectedVariants);
          const selectedReferenceSalePrice =
            selectedReferenceVariant?.salePrice ?? selectedProduct.basePrice;
          const selectedReferenceCostPrice =
            selectedReferenceVariant?.costPrice ?? selectedProduct.costPrice;
          const selectedReferenceNetPrice = selectedReferenceVariant?.netPrice ?? null;
          const selectedReferenceMarginPercentage =
            selectedReferenceVariant?.marginPercentage ?? null;

          return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-surface rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300 relative border border-theme"
            onClick={(event) => event.stopPropagation()}
          >

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
                    src={(selectedImages[0]?.url && selectedImages[0].url.trim().length > 0) ? selectedImages[0].url : '/placeholder.svg'}
                    alt={selectedProduct.name}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {selectedImages.slice(1).map((img, i) => (
                      <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-theme flex-shrink-0 relative shadow-sm">
                        <Image src={img.url || '/placeholder.svg'} alt="Miniatura del producto" width={64} height={64} className="w-full h-full object-cover" />
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
                      {formatProductStatus(selectedProduct.status)}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-primary leading-tight tracking-tighter">{selectedProduct.name}</h2>
                  <p className="text-xs text-muted font-bold mt-2 font-mono tracking-wider opacity-70">/{selectedProduct.slug}</p>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" /> Precio público
                    </p>
                    <p className="text-xl font-black text-primary">{formatCurrency(selectedReferenceSalePrice)}</p>
                  </div>
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <DollarSign className="w-3 h-3" /> Venta neta
                    </p>
                    <p className="text-xl font-black text-secondary">{formatOptionalCurrency(selectedReferenceNetPrice)}</p>
                  </div>
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Package className="w-3 h-3" /> Costo
                    </p>
                    <p className="text-xl font-black text-primary">{formatOptionalCurrency(selectedReferenceCostPrice)}</p>
                  </div>
                  <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                    <p className="text-[10px] text-muted font-black uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Margen bruto
                    </p>
                    <p className="text-xl font-black text-secondary">{formatOptionalPercentage(selectedReferenceMarginPercentage)}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Variantes & Stock
                    </h3>
                    <div className="bg-surface border border-theme rounded-2xl overflow-hidden">
                      <div className="max-w-full overflow-x-auto overflow-y-hidden pb-2 custom-scrollbar">
                        <table className="min-w-[920px] w-full text-xs text-left">
                          <thead className="bg-base/50 text-muted border-b border-theme">
                            <tr>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] whitespace-nowrap">SKU</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] whitespace-nowrap">Talla</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] whitespace-nowrap">Color</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right whitespace-nowrap">Costo adquisición</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right whitespace-nowrap">PVP con IVA</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right whitespace-nowrap">Venta neta</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right whitespace-nowrap">Margen bruto</th>
                              <th className="px-4 py-2.5 font-bold uppercase tracking-widest text-[9px] text-right whitespace-nowrap">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme/50">
                            {selectedVariants.map((v) => (
                              <tr key={v.id} className="group/row hover:bg-base/30 transition-colors">
                                <td className="px-4 py-2.5 font-mono text-muted text-[10px]">{v.sku}</td>
                                <td className="px-4 py-2.5 font-bold text-primary">{v.size || 'Sin talla'}</td>
                                <td className="px-4 py-2.5 font-bold text-primary">{v.color}</td>
                                <td className="px-4 py-2.5 text-right font-black text-primary">
                                  {formatOptionalCurrency(v.costPrice)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-primary">
                                  {formatCurrency(v.salePrice ?? selectedReferenceSalePrice)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-secondary">
                                  {formatOptionalCurrency(v.netPrice)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-primary">
                                  {formatOptionalPercentage(v.marginPercentage)}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <span className="font-black text-primary bg-base/50 px-2 py-0.5 rounded-md border border-theme/30" title="Stock actual (solo lectura)">
                                      {v.stock}
                                    </span>
                                    <Link
                                      href={`/dashboard/compras/recepcion?search=${v.sku}`}
                                      className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-all opacity-0 group-hover/row:opacity-100"
                                      title="Ver historial de lotes"
                                    >
                                      <Database className="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Attributes Section */}
                  <div>
                    <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3">ATRIBUTOS DE CONFIGURACIÓN</h3>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: 'Línea', type: 'LINE' },
                        { label: 'Calidad', type: 'QUALITY' },
                        { label: 'Material', type: 'MATERIAL' },
                      ].map((item) => {
                        const attr = selectedAttributes.find(a => a.type === item.type);
                        return (
                          <div key={item.type} className="p-3 bg-base/30 rounded-xl border border-theme/50 flex flex-col gap-1">
                            <span className="text-[8px] font-black uppercase text-muted tracking-widest">{item.label}</span>
                            <span className="text-[11px] font-bold text-primary">{attr?.value || 'No definido'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pricing Rules Section */}
                  {selectedPricingRules.length > 0 && (
                    <div>
                      <h3 className="text-xs font-black text-primary uppercase tracking-widest mb-3">Reglas de precio</h3>
                      <div className="space-y-2">
                        {selectedPricingRules.map((rule) => (
                          <div key={rule.id} className="px-4 py-3 bg-secondary/5 rounded-xl border border-secondary/20 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-secondary uppercase tracking-tighter">{rule.scope}</span>
                              <span className="text-muted">Min. {rule.minQty} unidades</span>
                            </div>
                            <div className="font-black text-primary">
                              {rule.discountPct ? `${rule.discountPct}% dto.` : rule.fixedUnitPrice ? formatCurrency(rule.fixedUnitPrice) : 'No aplica'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
          );
        })()
      )}
    </>
  );
}
