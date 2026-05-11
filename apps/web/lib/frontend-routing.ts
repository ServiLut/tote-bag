import {
  isDashboardPrivilegedRole,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { resolveDashboardRouteAlias } from '@/lib/dashboard-route-aliases';

export type CheckoutAuthStep = 'CHOICE' | 'GUEST_FORM' | 'AUTHENTICATED';

const ROLE_FALLBACK: DashboardRole = 'CUSTOMER';

const DASHBOARD_ROUTE_MATCHERS = {
  root: (pathname: string) => pathname === '/dashboard',
  orders: (pathname: string) =>
    pathname === '/dashboard/orders' ||
    pathname.startsWith('/dashboard/orders/'),
  products: (pathname: string) =>
    pathname === '/dashboard/products' ||
    pathname.startsWith('/dashboard/products/'),
  customers: (pathname: string) =>
    pathname === '/dashboard/customers' ||
    pathname.startsWith('/dashboard/customers/'),
  b2b: (pathname: string) =>
    pathname === '/dashboard/b2b' || pathname.startsWith('/dashboard/b2b/'),
  personalizations: (pathname: string) =>
    pathname === '/dashboard/personalizaciones' ||
    pathname.startsWith('/dashboard/personalizaciones/'),
  pqrs: (pathname: string) =>
    pathname === '/dashboard/pqrs' || pathname.startsWith('/dashboard/pqrs/'),
  knowledge: (pathname: string) =>
    pathname === '/dashboard/conocimiento' ||
    pathname.startsWith('/dashboard/conocimiento/'),
  finance: (pathname: string) =>
    pathname === '/dashboard/finanzas' ||
    pathname.startsWith('/dashboard/finanzas/') ||
    pathname === '/dashboard/reportes' ||
    pathname.startsWith('/dashboard/reportes/'),
  logistics: (pathname: string) =>
    pathname === '/dashboard/logistica/proveedores' ||
    pathname.startsWith('/dashboard/logistica/proveedores/') ||
    pathname === '/dashboard/logistica/envios' ||
    pathname.startsWith('/dashboard/logistica/envios/'),
  inventory: (pathname: string) =>
    pathname === '/dashboard/logistica/insumos' ||
    pathname.startsWith('/dashboard/logistica/insumos/') ||
    pathname === '/dashboard/logistica/inventario' ||
    pathname.startsWith('/dashboard/logistica/inventario/') ||
    pathname === '/dashboard/compras/recepcion' ||
    pathname.startsWith('/dashboard/compras/recepcion/'),
  strategy: (pathname: string) =>
    pathname === '/dashboard/strategy/pricing' ||
    pathname.startsWith('/dashboard/strategy/pricing/'),
  system: (pathname: string) =>
    pathname === '/dashboard/audit' ||
    pathname.startsWith('/dashboard/audit/') ||
    pathname === '/dashboard/settings' ||
    pathname.startsWith('/dashboard/settings/'),
} satisfies Record<string, (pathname: string) => boolean>;

export function getDashboardRoleFallback(): DashboardRole {
  return ROLE_FALLBACK;
}

export function isDashboardReadOnlyRole(
  _role: DashboardRole | null | undefined,
) {
  void _role;
  return false;
}

export function getPostLoginRedirectPath(role: DashboardRole | null | undefined) {
  return isDashboardPrivilegedRole(role) ? '/dashboard' : '/profile';
}

function isSafeInternalRedirect(redirectPath: string | null | undefined) {
  if (!redirectPath) {
    return false;
  }

  if (!redirectPath.startsWith('/') || redirectPath.startsWith('//')) {
    return false;
  }

  if (
    redirectPath.startsWith('/login') ||
    redirectPath.startsWith('/register') ||
    redirectPath.startsWith('/forgot-password') ||
    redirectPath.startsWith('/reset-password')
  ) {
    return false;
  }

  return true;
}

export function resolvePostLoginRedirectPath(options: {
  role: DashboardRole | null | undefined;
  requestedRedirect?: string | null;
}): string {
  const { role, requestedRedirect } = options;

  if (!isSafeInternalRedirect(requestedRedirect)) {
    return getPostLoginRedirectPath(role);
  }

  const safeRequestedRedirect = requestedRedirect as string;

  if (
    safeRequestedRedirect.startsWith('/dashboard') &&
    !isDashboardPrivilegedRole(role)
  ) {
    return getPostLoginRedirectPath(role);
  }

  return safeRequestedRedirect;
}

export function getCheckoutInitialAuthStep(hasSession: boolean): CheckoutAuthStep {
  return hasSession ? 'AUTHENTICATED' : 'CHOICE';
}

export function getCheckoutLoginHref(options?: { isB2B?: boolean | null }) {
  const isB2B =
    options?.isB2B ??
    (typeof window !== 'undefined'
      ? ['true', '1'].includes(
          new URLSearchParams(window.location.search).get('isB2B') ?? '',
        )
      : false);

  if (isB2B) {
    return `/login?redirect=${encodeURIComponent('/checkout?isB2B=true')}`;
  }

  return '/login?redirect=/checkout';
}

export function getCheckoutEmptyCartRedirectPath() {
  return '/catalog';
}

export function resolveCanonicalDashboardPath(pathname: string) {
  return resolveDashboardRouteAlias(pathname);
}

export function canAccessDashboardPath(
  role: DashboardRole | null | undefined,
  pathname: string,
) {
  if (!isDashboardPrivilegedRole(role)) {
    return false;
  }

  if (!pathname.startsWith('/dashboard')) {
    return true;
  }

  if (role === 'ADMIN') {
    return true;
  }

  if (DASHBOARD_ROUTE_MATCHERS.root(pathname)) {
    return true;
  }

  if (role === 'MANAGER') {
    return (
      DASHBOARD_ROUTE_MATCHERS.orders(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.products(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.b2b(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.personalizations(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.pqrs(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.knowledge(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.logistics(pathname) ||
      DASHBOARD_ROUTE_MATCHERS.strategy(pathname)
    );
  }

  return (
    DASHBOARD_ROUTE_MATCHERS.orders(pathname) ||
    DASHBOARD_ROUTE_MATCHERS.products(pathname)
  );
}

export function getDefaultDashboardPathForRole(
  role: DashboardRole | null | undefined,
) {
  if (!isDashboardPrivilegedRole(role)) {
    return '/profile';
  }

  if (canAccessDashboardPath(role, '/dashboard')) {
    return '/dashboard';
  }

  if (canAccessDashboardPath(role, '/dashboard/orders')) {
    return '/dashboard/orders';
  }

  if (canAccessDashboardPath(role, '/dashboard/products')) {
    return '/dashboard/products';
  }

  return '/dashboard';
}

export function resolveDashboardLayoutRedirect(options: {
  hasSession: boolean;
  role: DashboardRole | null | undefined;
  pathname?: string;
}) {
  const { hasSession, role, pathname } = options;

  if (!hasSession) {
    return '/login';
  }

  if (role === 'CUSTOMER') {
    return '/catalog';
  }

  // When the session exists but the role could not be resolved yet, avoid
  // degrading the user to CUSTOMER and let the dashboard finish role loading.
  if (role == null) {
    return null;
  }

  if (pathname && !canAccessDashboardPath(role, pathname)) {
    return getDefaultDashboardPathForRole(role);
  }

  return null;
}

export function resolveProxyAccess(options: {
  pathname: string;
  hasUser: boolean;
  role: DashboardRole | null | undefined;
  requestedRedirect?: string | null;
}) {
  const { pathname, hasUser, role, requestedRedirect } = options;
  const canonicalDashboardPath = resolveCanonicalDashboardPath(pathname);

  if (canonicalDashboardPath) {
    return canonicalDashboardPath;
  }

  const isAuthPage =
    pathname.startsWith('/login') || pathname.startsWith('/register');
  const isDashboardPage = pathname.startsWith('/dashboard');

  if (isDashboardPage && !hasUser) {
    return '/login';
  }

  if (isAuthPage && hasUser && role != null) {
    return resolvePostLoginRedirectPath({ role, requestedRedirect });
  }

  if (isDashboardPage && role != null && !canAccessDashboardPath(role, pathname)) {
    return getDefaultDashboardPathForRole(role);
  }

  return null;
}

export function getProfileNavigationPath(role: DashboardRole | null | undefined) {
  return isDashboardPrivilegedRole(role) ? '/dashboard' : '/profile';
}
