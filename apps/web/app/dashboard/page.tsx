import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Briefcase,
  Clock3,
  Factory,
  Inbox,
  Package,
  Sparkles,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/server';
import {
  extractRoleFromProfilePayload,
  getDashboardRoleForOperatorEmail,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { canAccessDashboardPath } from '@/lib/frontend-routing';

interface DashboardStats {
  dailyProduction: number;
  lowStockCount: number;
  pendingQuotes: number;
  newPqrsCount: number;
  pendingPaymentOrders: number;
  inProductionOrders: number;
  pendingShipments: number;
  pendingPersonalizationRequests: number;
  inReviewPersonalizationRequests: number;
  approvedPersonalizationRequests: number;
  staleBatches: number;
  supplierPendingBalance: number;
  monthlyCashFlowNet: number;
  topSellingProduct: {
    productId: string;
    productName: string;
    unitsSold: number;
    imageUrl: string | null;
  } | null;
  lowestSellingProduct: {
    productId: string;
    productName: string;
    unitsSold: number;
    imageUrl: string | null;
  } | null;
}

type DashboardStatsResult = DashboardStats & {
  loadError?: string;
};

function getFallbackDashboardStats(loadError: string): DashboardStatsResult {
  return {
    loadError,
    dailyProduction: 0,
    lowStockCount: 0,
    pendingQuotes: 0,
    newPqrsCount: 0,
    pendingPaymentOrders: 0,
    inProductionOrders: 0,
    pendingShipments: 0,
    pendingPersonalizationRequests: 0,
    inReviewPersonalizationRequests: 0,
    approvedPersonalizationRequests: 0,
    staleBatches: 0,
    supplierPendingBalance: 0,
    monthlyCashFlowNet: 0,
    topSellingProduct: null,
    lowestSellingProduct: null,
  };
}

function getDashboardStatsErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'No fue posible cargar las metricas del dashboard.';
  }

  if (error.message.startsWith('No fue posible conectar con la API.')) {
    return 'No fue posible conectar con la API local. Verifica que el backend este ejecutandose en el puerto 4004 y vuelve a cargar el dashboard.';
  }

  return error.message;
}

function isProductSalesBadge(
  value: unknown,
): value is NonNullable<DashboardStats['topSellingProduct']> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.productId === 'string' &&
    typeof candidate.productName === 'string' &&
    toFiniteNumber(candidate.unitsSold) !== null &&
    (candidate.imageUrl === null || typeof candidate.imageUrl === 'string')
  );
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDashboardStats(value: unknown): DashboardStats | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const dailyProduction = toFiniteNumber(candidate.dailyProduction);
  const lowStockCount = toFiniteNumber(candidate.lowStockCount);
  const pendingQuotes = toFiniteNumber(candidate.pendingQuotes);
  const newPqrsCount = toFiniteNumber(candidate.newPqrsCount);
  const pendingPaymentOrders = toFiniteNumber(candidate.pendingPaymentOrders);
  const inProductionOrders = toFiniteNumber(candidate.inProductionOrders);
  const pendingShipments = toFiniteNumber(candidate.pendingShipments);
  const pendingPersonalizationRequests = toFiniteNumber(
    candidate.pendingPersonalizationRequests,
  );
  const inReviewPersonalizationRequests = toFiniteNumber(
    candidate.inReviewPersonalizationRequests,
  );
  const approvedPersonalizationRequests = toFiniteNumber(
    candidate.approvedPersonalizationRequests,
  );
  const staleBatches = toFiniteNumber(candidate.staleBatches);
  const supplierPendingBalance = toFiniteNumber(candidate.supplierPendingBalance);
  const monthlyCashFlowNet = toFiniteNumber(candidate.monthlyCashFlowNet);

  if (
    dailyProduction === null ||
    lowStockCount === null ||
    pendingQuotes === null ||
    newPqrsCount === null ||
    pendingPaymentOrders === null ||
    inProductionOrders === null ||
    pendingShipments === null ||
    pendingPersonalizationRequests === null ||
    inReviewPersonalizationRequests === null ||
    approvedPersonalizationRequests === null ||
    staleBatches === null ||
    supplierPendingBalance === null ||
    monthlyCashFlowNet === null
  ) {
    return null;
  }

  return {
    dailyProduction,
    lowStockCount,
    pendingQuotes,
    newPqrsCount,
    pendingPaymentOrders,
    inProductionOrders,
    pendingShipments,
    pendingPersonalizationRequests,
    inReviewPersonalizationRequests,
    approvedPersonalizationRequests,
    staleBatches,
    supplierPendingBalance,
    monthlyCashFlowNet,
    topSellingProduct: isProductSalesBadge(candidate.topSellingProduct)
      ? {
          ...candidate.topSellingProduct,
          unitsSold: toFiniteNumber(candidate.topSellingProduct.unitsSold) ?? 0,
        }
      : null,
    lowestSellingProduct: isProductSalesBadge(candidate.lowestSellingProduct)
      ? {
          ...candidate.lowestSellingProduct,
          unitsSold:
            toFiniteNumber(candidate.lowestSellingProduct.unitsSold) ?? 0,
        }
      : null,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

async function getDashboardStats(): Promise<DashboardStatsResult> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  try {
    const headers = session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined;

    const statsRes = await apiFetch('/dashboard/stats', {
      cache: 'no-store',
      headers,
    });

    if (statsRes.status === 401 || statsRes.status === 403) {
      return getFallbackDashboardStats(
        'No tienes permisos para ver el dashboard operativo.',
      );
    }

    if (!statsRes.ok) {
      return getFallbackDashboardStats(
        `No fue posible cargar las metricas del dashboard. La API respondio con estado ${statsRes.status}.`,
      );
    }

    const statsBody = (await statsRes.json()) as
      | ApiResponse<DashboardStats>
      | DashboardStats;
    const payload =
      'data' in statsBody
        ? (statsBody as ApiResponse<DashboardStats>).data
        : statsBody;

    const normalizedPayload = normalizeDashboardStats(payload);

    if (!normalizedPayload) {
      return getFallbackDashboardStats(
        'La API devolvio metricas del dashboard en un formato invalido.',
      );
    }

    return normalizedPayload;
  } catch (error) {
    return getFallbackDashboardStats(getDashboardStatsErrorMessage(error));
  }
}

async function getCurrentDashboardRole(): Promise<DashboardRole | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return null;
  }

  try {
    const response = await apiFetch('/profiles/me', {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (response.ok) {
      const body = await response.json();
      return (
        extractRoleFromProfilePayload(body) ??
        getDashboardRoleForOperatorEmail(session.user.email)
      );
    }
  } catch {
    // The layout already protects the dashboard; keep the page resilient.
  }

  return getDashboardRoleForOperatorEmail(session.user.email);
}

function getAccessibleDashboardHref(
  role: DashboardRole | null,
  href: string,
  fallback = '/dashboard',
) {
  return canAccessDashboardPath(role, href) ? href : fallback;
}

export default async function DashboardPage() {
  const [stats, role] = await Promise.all([
    getDashboardStats(),
    getCurrentDashboardRole(),
  ]);
  const todayLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
  });
  const healthTone =
    stats.lowStockCount > 0 || stats.staleBatches > 0 || stats.monthlyCashFlowNet < 0
      ? 'warning'
      : 'success';
  const urgentActions =
    stats.pendingPaymentOrders +
    stats.pendingShipments +
    stats.newPqrsCount +
    stats.pendingPersonalizationRequests;
  const commercialLoad =
    stats.pendingQuotes +
    stats.inReviewPersonalizationRequests +
    stats.approvedPersonalizationRequests;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8 md:px-10 md:py-10 xl:px-12">
      <section className="relative overflow-hidden rounded-[36px] border border-theme bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(107,122,74,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,248,250,0.98))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(141,161,104,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.14),_transparent_28%),linear-gradient(180deg,rgba(34,34,34,0.96),rgba(28,28,28,0.96))]" />
        <div className="relative grid gap-6 p-6 md:p-8 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            {stats.loadError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                {stats.loadError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-muted shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                Resumen ejecutivo
              </span>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${
                  healthTone === 'warning'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {healthTone === 'warning' ? 'Requiere seguimiento' : 'Operacion estable'}
              </span>
            </div>

            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-black tracking-[-0.04em] text-primary md:text-5xl">
                Dashboard central para leer el negocio sin ruido.
              </h1>
              <p className="max-w-2xl text-sm font-medium leading-6 text-muted md:text-base">
                La vista principal prioriza carga operativa, demanda comercial, personalizaciones
                y control financiero en una sola lectura.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-4">
              <OverviewMetricCard
                label="Pedidos hoy"
                value={stats.dailyProduction}
                icon={<ShoppingBag className="h-5 w-5" />}
                accent="blue"
                href="/dashboard/orders"
                description="Produccion registrada del dia"
              />
              <OverviewMetricCard
                label="Acciones urgentes"
                value={urgentActions}
                icon={<Clock3 className="h-5 w-5" />}
                accent="amber"
                href="/dashboard/orders"
                description="Pagos, envios, PQRS y personalizaciones"
              />
              <OverviewMetricCard
                label="Carga comercial"
                value={commercialLoad}
                icon={<Briefcase className="h-5 w-5" />}
                accent="olive"
                href="/dashboard/b2b"
                description="Cotizaciones y flujo de aprobaciones"
              />
              <OverviewMetricCard
                label="Stock critico"
                value={stats.lowStockCount}
                icon={<Package className="h-5 w-5" />}
                accent="amber"
                href="/dashboard/products"
                description="SKUs activos con riesgo de quiebre"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="rounded-[28px] border border-theme bg-white/75 p-5 shadow-sm backdrop-blur dark:bg-white/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">
                      Prioridades del dia
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-primary">
                      Seguimiento inmediato
                    </h2>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted" />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MiniIndicator
                    label="Pend. pago"
                    value={stats.pendingPaymentOrders}
                    tone={stats.pendingPaymentOrders > 0 ? 'warning' : 'default'}
                  />
                  <MiniIndicator
                    label="Envios"
                    value={stats.pendingShipments}
                    tone={stats.pendingShipments > 0 ? 'warning' : 'default'}
                  />
                  <MiniIndicator
                    label="PQRS"
                    value={stats.newPqrsCount}
                    tone={stats.newPqrsCount > 0 ? 'warning' : 'default'}
                  />
                  <MiniIndicator
                    label="Disenos"
                    value={stats.pendingPersonalizationRequests}
                    tone={stats.pendingPersonalizationRequests > 0 ? 'warning' : 'default'}
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-black/5 bg-primary p-5 text-base-color shadow-[0_18px_40px_rgba(17,17,17,0.18)] dark:border-white/10">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-base-color/70">
                  Panorama financiero
                </p>
                <div className="mt-4 grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-base-color/70">
                      Flujo neto mensual
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {formatCurrency(stats.monthlyCashFlowNet)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-base-color/70">
                      Saldo pendiente a proveedores
                    </p>
                    <p className="mt-2 text-2xl font-black">
                      {formatCurrency(stats.supplierPendingBalance)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <p className="text-sm font-medium text-base-color/70">{todayLabel}</p>
                  <Link
                    href={getAccessibleDashboardHref(
                      role,
                      '/dashboard/finanzas/cash-flow',
                    )}
                    className="inline-flex items-center gap-2 text-sm font-black text-base-color transition-transform hover:translate-x-0.5"
                  >
                    Ver finanzas
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <aside className="grid gap-4">
            <ProductSpotlightCard
              title="Producto mas vendido"
              product={stats.topSellingProduct}
              emptyLabel="Sin ventas confirmadas"
              href="/dashboard/orders"
              tone="success"
            />
            <ProductSpotlightCard
              title="Producto menos vendido"
              product={stats.lowestSellingProduct}
              emptyLabel="Sin ventas confirmadas"
              href="/dashboard/orders"
              tone="warning"
            />
          </aside>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <IndicatorCluster
          title="Operacion"
          description="Pedidos y movimientos que sostienen el cumplimiento diario."
          eyebrow="Ejecucion"
        >
          <div className="grid gap-4">
            <InfoBadge
              label="Pedidos pendientes de pago"
              value={String(stats.pendingPaymentOrders)}
              icon={<Receipt className="h-4 w-4" />}
              href="/dashboard/orders"
              tone={stats.pendingPaymentOrders > 0 ? 'warning' : 'default'}
            />
            <InfoBadge
              label="Pedidos en produccion"
              value={String(stats.inProductionOrders)}
              icon={<Factory className="h-4 w-4" />}
              href="/dashboard/orders"
            />
            <InfoBadge
              label="Envios pendientes"
              value={String(stats.pendingShipments)}
              icon={<Truck className="h-4 w-4" />}
              href="/dashboard/logistica/envios"
              tone={stats.pendingShipments > 0 ? 'warning' : 'default'}
            />
          </div>
        </IndicatorCluster>

        <IndicatorCluster
          title="Comercial y personalizacion"
          description="Frentes que convierten interes en pedidos cerrados y aprobados."
          eyebrow="Demanda"
        >
          <div className="grid gap-4">
            <InfoBadge
              label="Cotizaciones B2B pendientes"
              value={String(stats.pendingQuotes)}
              icon={<Briefcase className="h-4 w-4" />}
              href="/dashboard/b2b"
              tone={stats.pendingQuotes > 0 ? 'warning' : 'default'}
            />
            <InfoBadge
              label="Solicitudes pendientes"
              value={String(stats.pendingPersonalizationRequests)}
              icon={<Sparkles className="h-4 w-4" />}
              href="/dashboard/personalizaciones"
              tone={stats.pendingPersonalizationRequests > 0 ? 'warning' : 'default'}
            />
            <InfoBadge
              label="Solicitudes en revision"
              value={String(stats.inReviewPersonalizationRequests)}
              icon={<Clock3 className="h-4 w-4" />}
              href="/dashboard/personalizaciones"
              tone={stats.inReviewPersonalizationRequests > 0 ? 'warning' : 'default'}
            />
            <InfoBadge
              label="Solicitudes aprobadas"
              value={String(stats.approvedPersonalizationRequests)}
              icon={<Sparkles className="h-4 w-4" />}
              href="/dashboard/personalizaciones"
              tone={stats.approvedPersonalizationRequests > 0 ? 'success' : 'default'}
            />
          </div>
        </IndicatorCluster>

        <IndicatorCluster
          title="Control"
          description="Alertas que conviene vigilar para evitar friccion operativa."
          eyebrow="Monitoreo"
          accent="warning"
        >
          <div className="grid gap-4">
            <InfoBadge
              label="PQRS nuevas"
              value={String(stats.newPqrsCount)}
              icon={<Inbox className="h-4 w-4" />}
              href="/dashboard/pqrs"
              tone={stats.newPqrsCount > 0 ? 'warning' : 'default'}
            />
            <InfoBadge
              label="Lotes estancados"
              value={String(stats.staleBatches)}
              icon={<Boxes className="h-4 w-4" />}
              href={getAccessibleDashboardHref(
                role,
                '/dashboard/logistica/inventario',
                '/dashboard/products',
              )}
              tone={stats.staleBatches > 0 ? 'warning' : 'default'}
            />
            <div className="grid gap-3 rounded-[24px] border border-theme bg-white/70 p-4 shadow-sm dark:bg-white/5">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">
                Resumen rapido
              </p>
              <div className="grid grid-cols-3 gap-3">
                <MiniIndicator
                  label="Stock"
                  value={stats.lowStockCount}
                  tone={stats.lowStockCount > 0 ? 'warning' : 'default'}
                />
                <MiniIndicator
                  label="PQRS"
                  value={stats.newPqrsCount}
                  tone={stats.newPqrsCount > 0 ? 'warning' : 'default'}
                />
                <MiniIndicator
                  label="Lotes"
                  value={stats.staleBatches}
                  tone={stats.staleBatches > 0 ? 'warning' : 'default'}
                />
              </div>
            </div>
          </div>
        </IndicatorCluster>
      </section>
    </div>
  );
}

function IndicatorCluster({
  title,
  description,
  eyebrow,
  accent = 'default',
  children,
}: {
  title: string;
  description: string;
  eyebrow: string;
  accent?: 'default' | 'warning';
  children: React.ReactNode;
}) {
  const accentStyles = {
    default:
      'border-theme bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(255,255,255,0.96))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.05))]',
    warning:
      'border-amber-200 bg-[linear-gradient(180deg,rgba(255,248,235,0.95),rgba(255,255,255,0.98))] dark:border-amber-900 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.18),rgba(255,255,255,0.03))]',
  };

  return (
    <div className={`rounded-[28px] border p-5 shadow-sm ${accentStyles[accent]}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">
            {eyebrow}
          </p>
          <h3 className="text-2xl font-black tracking-[-0.03em] text-primary">{title}</h3>
          <p className="max-w-xl text-sm font-medium leading-6 text-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  icon,
  href,
  description,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
  description: string;
  accent: 'blue' | 'amber' | 'olive';
}) {
  const accents = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    olive: 'bg-secondary/15 text-secondary',
  };

  return (
    <Link
      href={href}
      className="group rounded-[26px] border border-theme bg-white/75 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-2xl p-3 ${accents[accent]}`}>{icon}</div>
        <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted">{label}</p>
        <p className="mt-2 text-4xl font-black tracking-[-0.04em] text-primary">{value}</p>
        <p className="mt-3 text-sm font-medium leading-5 text-muted">{description}</p>
      </div>
    </Link>
  );
}

function ProductSpotlightCard({
  title,
  product,
  emptyLabel,
  href,
  tone,
}: {
  title: string;
  product: DashboardStats['topSellingProduct'];
  emptyLabel: string;
  href: string;
  tone: 'success' | 'warning';
}) {
  const tones = {
    success:
      'border-emerald-200/80 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100',
    warning:
      'border-amber-200/80 bg-amber-50/80 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-100',
  };

  return (
    <Link
      href={href}
      className={`group flex h-full flex-col justify-between rounded-[28px] border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-70">{title}</p>
          <p className="mt-3 text-xl font-black tracking-[-0.03em]">
            {product ? product.productName : emptyLabel}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="relative mt-6 min-h-[264px] overflow-hidden rounded-[30px] border border-current/10 bg-white/40 p-4 dark:bg-white/5 md:min-h-[292px]">
        {product?.imageUrl ? (
          <div className="absolute inset-[10px] overflow-hidden rounded-[26px] border border-black/10 bg-white/70 shadow-sm dark:border-white/10">
            <Image src={product.imageUrl} alt={title} fill className="object-cover object-center" />
          </div>
        ) : (
          <div className="absolute inset-[10px] flex items-center justify-center rounded-[26px] border border-dashed border-current/20 bg-white/60 text-sm font-black opacity-70 dark:bg-white/5">
            Sin imagen
          </div>
        )}
        <div className="absolute bottom-6 right-6 z-10 flex w-[122px] shrink-0 flex-col items-center justify-center gap-2 rounded-[22px] border border-white/30 bg-white/30 px-4 py-4 text-center shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[rgba(34,34,34,0.52)]">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">Ventas</p>
          </div>
          <p className="shrink-0 text-[2.15rem] font-black leading-none tracking-[-0.04em]">
            {product?.unitsSold ?? 0}
          </p>
        </div>
      </div>
    </Link>
  );
}

function MiniIndicator({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}) {
  const tones = {
    default: 'border-theme bg-surface text-primary',
    warning:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200',
  };

  return (
    <div className={`rounded-2xl border px-3 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.03em]">{value}</p>
    </div>
  );
}

function InfoBadge({
  label,
  value,
  icon,
  href,
  tone = 'default',
  imageUrl = null,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  href: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
  imageUrl?: string | null;
}) {
  const tones = {
    default:
      'border-theme bg-surface text-primary hover:border-black/10 dark:hover:border-white/10',
    warning:
      'border-amber-200 bg-[linear-gradient(135deg,rgba(251,243,219,0.95),rgba(255,255,255,0.96))] text-amber-800 dark:border-amber-900 dark:bg-[linear-gradient(135deg,rgba(69,26,3,0.45),rgba(34,34,34,0.9))] dark:text-amber-200',
    danger:
      'border-rose-200 bg-[linear-gradient(135deg,rgba(255,228,230,0.95),rgba(255,255,255,0.96))] text-rose-800 dark:border-rose-900 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.42),rgba(34,34,34,0.9))] dark:text-rose-200',
    success:
      'border-emerald-200 bg-[linear-gradient(135deg,rgba(220,252,231,0.95),rgba(255,255,255,0.96))] text-emerald-800 dark:border-emerald-900 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.36),rgba(34,34,34,0.9))] dark:text-emerald-200',
  };

  return (
    <Link
      href={href}
      className={`group flex min-h-28 items-center justify-between gap-4 rounded-[26px] border px-4 py-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tones[tone]}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {imageUrl ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-sm dark:border-white/10">
            <Image src={imageUrl} alt={label} fill className="object-cover" />
          </div>
        ) : (
          <div className="shrink-0 rounded-2xl bg-black/5 p-3 dark:bg-white/[0.08]">{icon}</div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">{label}</p>
          <p className="mt-1 line-clamp-2 text-lg font-black leading-5">{value}</p>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
