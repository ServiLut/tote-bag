export const DASHBOARD_ROUTE_ALIASES = [
  {
    source: '/dashboard/finance',
    destination: '/dashboard/finanzas',
  },
  {
    source: '/dashboard/finance/cash-flow',
    destination: '/dashboard/finanzas/cash-flow',
  },
  {
    source: '/dashboard/finance/opex',
    destination: '/dashboard/finanzas/opex',
  },
  {
    source: '/dashboard/logistics/inventory',
    destination: '/dashboard/logistica/inventario',
  },
  {
    source: '/dashboard/logistics/suppliers',
    destination: '/dashboard/logistica/insumos',
  },
  {
    source: '/dashboard/compras/proveedores',
    destination: '/dashboard/logistica/insumos',
  },
] as const;

export function resolveDashboardRouteAlias(pathname: string) {
  return (
    DASHBOARD_ROUTE_ALIASES.find((alias) => alias.source === pathname)
      ?.destination ?? null
  );
}
