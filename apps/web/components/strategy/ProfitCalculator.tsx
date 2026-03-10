'use client';

import { useEffect, useState } from 'react';
import { ApiResponse } from '@/types/api';
import { Product } from '@/types/product';
import { AlertCircle, Calculator, DollarSign, Loader2, TrendingUp } from 'lucide-react';

export default function ProfitCalculator() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);
  const [avgCost, setAvgCost] = useState<number>(0);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsError(null);

        const res = await fetch(`${API_URL}/catalog/products`);
        if (!res.ok) {
          throw new Error('No se pudo cargar el catalogo de productos.');
        }

        const body: ApiResponse<Product[]> = await res.json();
        setProducts(body.data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setProductsError('No se pudieron cargar los productos para analizar margenes.');
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, [API_URL]);

  useEffect(() => {
    const product = products.find((item) => item.id === selectedProductId);

    if (!product) {
      setAvgCost(0);
      setSuggestedPrice(0);
      return;
    }

    setSuggestedPrice(product.basePrice || 0);
  }, [API_URL, products, selectedProductId]);

  const grossProfit = suggestedPrice - avgCost;
  const hasSelection = Boolean(selectedProductId);
  const hasRealCost = avgCost > 0;
  const canCalculateMetrics = hasSelection && hasRealCost;
  const marginPercentage = canCalculateMetrics && suggestedPrice > 0 ? (grossProfit / suggestedPrice) * 100 : 0;
  const markupPercentage = canCalculateMetrics && avgCost > 0 ? (grossProfit / avgCost) * 100 : 0;

  const getTargetPrice = (targetMargin: number) => {
    if (avgCost <= 0 || targetMargin >= 100) return 0;
    return avgCost / (1 - targetMargin / 100);
  };

  return (
    <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-primary">Calculadora de Margenes</h2>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
              Seleccionar Producto
            </label>
            {productsLoading ? (
              <div className="flex items-center gap-2 py-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Cargando productos...</span>
              </div>
            ) : productsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {productsError}
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-medium text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleccione un producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
              Costo Promedio Ponderado
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted">$</div>
              <input
                type="number"
                value={avgCost}
                disabled={!hasSelection}
                onChange={(event) => setAvgCost(Number(event.target.value))}
                className="w-full rounded-xl border border-theme bg-base py-3 pl-8 pr-4 font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            {hasSelection && !hasRealCost ? (
              <p className="mt-1 text-[10px] font-medium italic text-amber-600">
                Ingresa un costo para calcular utilidad, margen y markup.
              </p>
            ) : (
              <p className="mt-1 text-[10px] font-medium italic text-muted">
                Valor manual editable para simular escenarios de pricing.
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
              Precio de Venta Sugerido
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted">$</div>
              <input
                type="number"
                value={suggestedPrice}
                disabled={!hasSelection}
                onChange={(event) => setSuggestedPrice(Number(event.target.value))}
                className="w-full rounded-xl border border-theme bg-base py-3 pl-8 pr-4 font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[20, 30, 40, 50].map((targetMargin) => (
              <div key={targetMargin} className="rounded-xl border border-theme bg-base px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Precio {targetMargin}%
                </p>
                <p className="mt-1 text-sm font-black text-primary">
                  {canCalculateMetrics
                    ? `$${Math.round(getTargetPrice(targetMargin)).toLocaleString('es-CO')}`
                    : '--'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-center space-y-6 rounded-2xl border border-primary/10 bg-primary/5 p-6">
          {!hasSelection && (
            <div className="flex items-start gap-3 rounded-xl border border-theme bg-base px-4 py-3 text-sm text-muted">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Selecciona un producto para calcular utilidad, margen y precios objetivo.</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary/60">Utilidad Bruta</p>
            <div className="flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              <span className="text-3xl font-black text-primary">
                {canCalculateMetrics ? grossProfit.toLocaleString('es-CO') : '--'}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary/60">
              Margen de Contribucion
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
              <span className={`text-3xl font-black ${marginPercentage > 30 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {canCalculateMetrics ? `${marginPercentage.toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-bold uppercase tracking-widest text-primary/60">
              Markup sobre costo
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <span className="text-3xl font-black text-primary">
                {canCalculateMetrics ? `${markupPercentage.toFixed(1)}%` : '--'}
              </span>
            </div>
          </div>

          <div className="border-t border-primary/10 pt-4">
            {canCalculateMetrics ? (
              <div
                className={`rounded-lg px-3 py-2 text-center text-xs font-bold ${
                  marginPercentage > 40
                    ? 'bg-emerald-100 text-emerald-700'
                    : marginPercentage > 20
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                }`}
              >
                {marginPercentage > 40
                  ? 'MARGEN EXCELENTE'
                  : marginPercentage > 20
                    ? 'MARGEN ACEPTABLE'
                    : 'ALERTA: MARGEN BAJO'}
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                SIN COSTO SUFICIENTE PARA CALCULAR MARGEN
              </div>
            )}
          </div>

          {canCalculateMetrics && suggestedPrice < avgCost && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              El precio sugerido esta por debajo del costo promedio ponderado del inventario activo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
