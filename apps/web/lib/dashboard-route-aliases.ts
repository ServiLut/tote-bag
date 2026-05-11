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
    source: '/dashboard/finance/nomina',
    destination: '/dashboard/finanzas/nomina',
  },
  {
    source: '/dashboard/reports',
    destination: '/dashboard/reportes',
  },
  {
    source: '/dashboard/logistics/inventory',
    destination: '/dashboard/logistica/inventario',
  },
  {
    source: '/dashboard/logistics/inventory/non-commercial-outputs',
    destination: '/dashboard/logistica/inventario/salidas-no-comerciales',
  },
  {
    source: '/dashboard/logistics/providers',
    destination: '/dashboard/logistica/proveedores',
  },
  {
    source: '/dashboard/logistics/shipping',
    destination: '/dashboard/logistica/envios',
  },
  {
    source: '/dashboard/logistics/suppliers',
    destination: '/dashboard/logistica/insumos',
  },
  {
    source: '/dashboard/compras/proveedores',
    destination: '/dashboard/logistica/insumos',
  },
  {
    source: '/dashboard/purchases/billing',
    destination: '/dashboard/compras/facturacion',
  },
  {
    source: '/dashboard/purchases/receiving',
    destination: '/dashboard/compras/recepcion',
  },
] as const;

export function resolveDashboardRouteAlias(pathname: string) {
  return (
    DASHBOARD_ROUTE_ALIASES.find((alias) => alias.source === pathname)
      ?.destination ?? null
  );
}
