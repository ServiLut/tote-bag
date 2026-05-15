'use client';

import { useEffect, useState } from 'react';
import { ApiResponse } from '@/types/api';
import { Product, Variant } from '@/types/product';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
} from '@/lib/numeric-input';
import {
  AlertCircle,
  ArrowDownToLine,
  Calculator,
  DollarSign,
  Loader2,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Input, InputGroup } from '@tote-bag/ui';
import { apiFetch } from '@/utils/api';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';

type GatewayMarginGrid = {
  current: {
    ingresoBruto: number;
    ventaNetaSinIva: number;
    iva: number;
    costoProducto: number;
    comisionWompi: number;
    ivaComision: number;
    costoLogisticoCif: number;
    netoRecibidoBanco: number;
    retencionesActivas: number;
    utilidadBruta: number;
    utilidadOperativa: number;
    utilidadNeta: number;
    margenSobreNetoPasarela: number | null;
    alertaMargenBajo: boolean;
  };
  targets: Array<{
    targetMargin: number;
    requiredGrossAmount: number | null;
    requiredNetReceivedAmount: number | null;
    expectedNetProfit: number | null;
    reachable: boolean;
  }>;
};

function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return '--';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercentage(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return `${(value * 100).toFixed(1)}%`;
}

function getReferenceVariant(product: Product | undefined): Variant | undefined {
  if (!product) {
    return undefined;
  }

  return (
    product.variants.find((variant) => variant.isActive !== false) ||
    product.variants[0]
  );
}

function unwrapApiData<T>(body: ApiResponse<T> | T): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return ((body as ApiResponse<T>).data || null) as T;
  }

  return body as T;
}

export default function ProfitCalculator() {
  const { accessToken } = useDashboardAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsSource, setProductsSource] = useState<'admin' | 'catalog' | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [targetMarginPercent, setTargetMarginPercent] = useState('60');
  const [quantity, setQuantity] = useState('1');
  const [discountPercent, setDiscountPercent] = useState('0');
  const [suggestedPrice, setSuggestedPrice] = useState(() =>
    createCurrencyInputState(0),
  );
  const [avgCost, setAvgCost] = useState(() => createCurrencyInputState(''));
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [grid, setGrid] = useState<GatewayMarginGrid | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);

  const selectedProduct = products.find((item) => item.id === selectedProductId);
  const referenceVariant = getReferenceVariant(selectedProduct);
  const referenceTaxRate =
    typeof referenceVariant?.taxRate === 'string'
      ? Number(referenceVariant.taxRate)
      : (referenceVariant?.taxRate ?? 0.19);
  const parsedTargetMarginPercent = Number(
    String(targetMarginPercent).replace(',', '.'),
  );
  const parsedQuantity = Number(quantity);
  const parsedDiscountPercent = Number(
    String(discountPercent).replace(',', '.'),
  );
  const hasValidQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity > 0;
  const hasValidTargetMargin =
    Number.isFinite(parsedTargetMarginPercent) &&
    parsedTargetMarginPercent >= 0 &&
    parsedTargetMarginPercent <= 100;
  const hasValidDiscount =
    Number.isFinite(parsedDiscountPercent) &&
    parsedDiscountPercent >= 0 &&
    parsedDiscountPercent <= 100;
  const hasSelection = Boolean(selectedProductId);
  const hasRealCost = avgCost.numericValue > 0;

  const effectiveUnitGrossAmount =
    suggestedPrice.numericValue * (1 - parsedDiscountPercent / 100);

  const canCalculateMetrics =
    hasSelection &&
    hasRealCost &&
    suggestedPrice.numericValue > 0 &&
    hasValidTargetMargin &&
    hasValidQuantity &&
    hasValidDiscount;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsError(null);

        if (!accessToken) {
          throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
        }

        let res = await apiFetch('/catalog/admin/products', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        let source: 'admin' | 'catalog' = 'admin';

        if (res.status === 401 || res.status === 403) {
          res = await apiFetch('/catalog/products', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          source = 'catalog';
        }

        if (!res.ok) {
          throw new Error('No se pudo cargar el catalogo de productos.');
        }

        const body: ApiResponse<Product[]> = await res.json();
        setProducts(body.data || []);
        setProductsSource(source);
      } catch (err) {
        console.error('Error fetching products:', err);
        setProductsError(
          'No se pudieron cargar los productos para analizar margenes.',
        );
        setProductsSource(null);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, [accessToken]);

  useEffect(() => {
    if (!selectedProduct) {
      setAvgCost(createCurrencyInputState(''));
      setSuggestedPrice(createCurrencyInputState(0));
      setGrid(null);
      return;
    }

    setSuggestedPrice(
      createCurrencyInputState(
        referenceVariant?.salePrice ?? selectedProduct.basePrice ?? 0,
      ),
    );
    setAvgCost(
      createCurrencyInputState(
        referenceVariant?.totalCost ?? referenceVariant?.costPrice ?? '',
      ),
    );
  }, [referenceVariant?.costPrice, referenceVariant?.salePrice, referenceVariant?.totalCost, selectedProduct]);

  useEffect(() => {
    let active = true;

    const fetchGrid = async () => {
      if (!canCalculateMetrics || !accessToken) {
        setGrid(null);
        setGridError(null);
        setGridLoading(false);
        return;
      }

      setGridLoading(true);
      setGridError(null);

      try {
        const response = await apiFetch('/finance/gateway-margin-grid', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            grossAmount: effectiveUnitGrossAmount,
            productCost: avgCost.numericValue,
            taxRate: referenceTaxRate,
            marginTarget: parsedTargetMarginPercent,
            targetMargins: [parsedTargetMarginPercent],
            quantity: parsedQuantity,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'No se pudo calcular la malla financiera.');
        }

        const body = (await response.json()) as ApiResponse<GatewayMarginGrid>;
        if (!active) {
          return;
        }

        setGrid(unwrapApiData(body));
      } catch (error) {
        console.error('Error fetching gateway margin grid:', error);
        if (active) {
          setGridError(
            error instanceof Error
              ? error.message
              : 'No se pudo calcular la malla financiera.',
          );
          setGrid(null);
        }
      } finally {
        if (active) {
          setGridLoading(false);
        }
      }
    };

    fetchGrid();

    return () => {
      active = false;
    };
  }, [
    accessToken,
    avgCost.numericValue,
    canCalculateMetrics,
    effectiveUnitGrossAmount,
    parsedQuantity,
    parsedTargetMarginPercent,
    referenceTaxRate,
  ]);

  const current = grid?.current ?? null;

  return (
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">
            Malla de Margen sobre Neto de Pasarela
          </h2>
          <p className="text-xs font-medium text-muted">
            Calcula con backend financiero para una o varias unidades y descuentos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.5fr_1fr]">
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
                Cantidad
              </label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                disabled={!hasSelection}
                onChange={(event) => setQuantity(event.target.value)}
                className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {productsSource === 'catalog' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
              Estas viendo el catalogo publico porque tu rol no tiene acceso al endpoint administrativo.
              El simulador sigue funcionando, pero debes confirmar manualmente costo e IVA de referencia.
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
                Costo Unitario
              </label>
              <InputGroup
                prefix={<span className="font-bold text-muted">$</span>}
                className="flex items-center gap-2 rounded-xl border border-theme bg-base px-4"
              >
                <Input
                  type="text"
                  inputMode="decimal"
                  value={avgCost.formattedValue}
                  disabled={!hasSelection}
                  onChange={(event) =>
                    handleCurrencyInputChangeWithState(event, setAvgCost)
                  }
                  className="w-full bg-transparent py-3 font-bold text-primary outline-none transition-all focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </InputGroup>
              <p className="mt-1 text-[10px] font-medium italic text-muted">
                Costo por unidad.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
                Porcentaje de Ganancia
              </label>
              <InputGroup
                suffix={<span className="font-bold text-muted">%</span>}
                className="flex items-center gap-2 rounded-xl border border-theme bg-base px-4"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  value={targetMarginPercent}
                  disabled={!hasSelection}
                  onChange={(event) => setTargetMarginPercent(event.target.value)}
                  className="w-full bg-transparent py-3 font-bold text-primary outline-none transition-all focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </InputGroup>
              <p className="mt-1 text-[10px] font-medium italic text-muted">
                Meta de utilidad sobre neto.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
                PVP Unitario (Base)
              </label>
              <InputGroup
                prefix={<span className="font-bold text-muted">$</span>}
                className="flex items-center gap-2 rounded-xl border border-theme bg-base px-4"
              >
                <Input
                  type="text"
                  inputMode="decimal"
                  value={suggestedPrice.formattedValue}
                  disabled={!hasSelection}
                  onChange={(event) =>
                    handleCurrencyInputChangeWithState(event, setSuggestedPrice)
                  }
                  className="w-full bg-transparent py-3 font-bold text-primary outline-none transition-all focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </InputGroup>
              <p className="mt-1 text-[10px] font-medium italic text-muted">
                Precio de lista con IVA.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-muted">
                Descuento aplicado
              </label>
              <InputGroup
                suffix={<span className="font-bold text-muted">%</span>}
                className="flex items-center gap-2 rounded-xl border border-theme bg-base px-4"
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.1"
                  value={discountPercent}
                  disabled={!hasSelection}
                  onChange={(event) => setDiscountPercent(event.target.value)}
                  className="w-full bg-transparent py-3 font-bold text-primary outline-none transition-all focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </InputGroup>
              <p className="mt-1 text-[10px] font-medium italic text-muted">
                Se aplica al PVP Unitario.
              </p>
            </div>
          </div>

          {parsedDiscountPercent > 0 ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-xs font-bold text-blue-700">
                PVP Efectivo con Descuento: {formatCurrency(effectiveUnitGrossAmount)}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            {(grid?.targets || []).map((target) => (
              <div
                key={target.targetMargin}
                className="rounded-xl border border-theme bg-base px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    Meta {formatPercentage(target.targetMargin)}
                  </p>
                  <p className="text-[10px] font-bold text-primary/60">
                    Sugerido Unitario (Sin descuento adicional)
                  </p>
                </div>
                <p className="mt-2 text-lg font-black text-primary">
                  {target.reachable
                    ? formatCurrency(target.requiredGrossAmount)
                    : 'No alcanzable'}
                </p>
                <p className="mt-1 text-[11px] font-medium text-muted">
                  Neto estimado total:{' '}
                  {target.reachable
                    ? formatCurrency(target.requiredNetReceivedAmount)
                    : '--'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6 rounded-2xl border border-primary/10 bg-primary/5 p-6">
          {!hasSelection ? (
            <div className="flex items-start gap-3 rounded-xl border border-theme bg-base px-4 py-3 text-sm text-muted">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Selecciona un producto y cantidad para calcular utilidad real y margen
                sobre recaudo neto de pasarela.
              </p>
            </div>
          ) : null}

          {gridLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-theme bg-base px-4 py-3 text-sm font-medium text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando motor financiero...
            </div>
          ) : null}

          {gridError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {gridError}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-primary">Estudio para {parsedQuantity} {parsedQuantity === 1 ? 'unidad' : 'unidades'}</h3>
            </div>
            {parsedDiscountPercent > 0 ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                DESC. {parsedDiscountPercent}%
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-theme bg-base px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Venta neta (Total sin IVA)
              </p>
              <p className="mt-2 text-2xl font-black text-primary">
                {formatCurrency(current?.ventaNetaSinIva)}
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-base px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Neto recibido banco
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-blue-600">
                <ArrowDownToLine className="h-5 w-5" />
                {formatCurrency(current?.netoRecibidoBanco)}
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-base px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Utilidad bruta
              </p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-primary">
                <DollarSign className="h-5 w-5" />
                {formatCurrency(current?.utilidadBruta)}
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-base px-4 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Utilidad neta real
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-600">
                {formatCurrency(current?.utilidadNeta)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-theme bg-base px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                IVA venta total
              </p>
              <p className="mt-1 text-lg font-black text-primary">
                {formatCurrency(current?.iva)}
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-base px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Comision + IVA
              </p>
              <p className="mt-1 text-lg font-black text-primary">
                {formatCurrency(
                  (current?.comisionWompi || 0) + (current?.ivaComision || 0),
                )}
              </p>
            </div>
            <div className="rounded-xl border border-theme bg-base px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                Retenciones activas
              </p>
              <p className="mt-1 flex items-center gap-2 text-lg font-black text-amber-600">
                <Receipt className="h-4 w-4" />
                {formatCurrency(current?.retencionesActivas)}
              </p>
            </div>
          </div>

          <div className="border-t border-primary/10 pt-4">
            {current ? (
              <div
                className={`rounded-lg px-3 py-3 text-center text-xs font-bold ${
                  current.alertaMargenBajo
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {current.alertaMargenBajo
                  ? `ALERTA: margen sobre neto de pasarela en ${formatPercentage(
                      current.margenSobreNetoPasarela,
                    )}, por debajo del objetivo de ${parsedTargetMarginPercent.toFixed(1)}%`
                  : `Margen sobre neto de pasarela saludable: ${formatPercentage(
                      current.margenSobreNetoPasarela,
                    )}`}
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-100 px-3 py-2 text-center text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                SIN DATOS SUFICIENTES PARA CALCULAR EL MOTOR FINANCIERO
              </div>
            )}
          </div>

          {canCalculateMetrics &&
          effectiveUnitGrossAmount < avgCost.numericValue ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              El PVP efectivo con descuento esta por debajo del costo cargado
              para este escenario.
            </div>
          ) : null}

          <div className="rounded-xl border border-theme bg-base px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              Referencia actual
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-primary">
              <TrendingUp className="h-4 w-4 text-primary" />
              {referenceVariant?.sku || 'Sin SKU comercial activo'}
            </p>
            <p className="mt-1 text-[11px] font-medium text-muted">
              El backend estima Wompi, IVA comisión, CIF empaque y retenciones
              con la configuración actual del ambiente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
