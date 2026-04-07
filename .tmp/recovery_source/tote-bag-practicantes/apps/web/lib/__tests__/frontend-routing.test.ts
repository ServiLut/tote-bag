import {
  canAccessDashboardPath,
  getDashboardRoleFallback,
  resolveCanonicalDashboardPath,
  getCheckoutInitialAuthStep,
  getCheckoutLoginHref,
  getProfileNavigationPath,
  getPostLoginRedirectPath,
  isDashboardReadOnlyRole,
  resolveDashboardLayoutRedirect,
  resolvePostLoginRedirectPath,
  resolveProxyAccess,
} from '../frontend-routing';

describe('frontend routing guards', () => {
  it('envia a dashboard despues del login para roles internos', () => {
    expect(getPostLoginRedirectPath('ADMIN')).toBe('/dashboard');
    expect(getPostLoginRedirectPath('MANAGER')).toBe('/dashboard');
  });

  it('envia a profile despues del login para customer', () => {
    expect(getPostLoginRedirectPath('CUSTOMER')).toBe('/profile');
    expect(getPostLoginRedirectPath(null)).toBe('/profile');
  });

  it('inicializa checkout autenticado cuando existe sesion', () => {
    expect(getCheckoutInitialAuthStep(true)).toBe('AUTHENTICATED');
    expect(getCheckoutInitialAuthStep(false)).toBe('CHOICE');
    expect(getCheckoutLoginHref()).toBe('/login?redirect=/checkout');
  });

  it('protege dashboard layout cuando no hay sesion o rol invalido', () => {
    expect(
      resolveDashboardLayoutRedirect({
        hasSession: false,
        role: null,
        pathname: '/dashboard',
      }),
    ).toBe('/login');
    expect(
      resolveDashboardLayoutRedirect({
        hasSession: true,
        role: 'CUSTOMER',
        pathname: '/dashboard',
      }),
    ).toBe('/catalog');
    expect(
      resolveDashboardLayoutRedirect({
        hasSession: true,
        role: null,
        pathname: '/dashboard',
      }),
    ).toBeNull();
    expect(
      resolveDashboardLayoutRedirect({
        hasSession: true,
        role: 'MANAGER',
        pathname: '/dashboard/orders',
      }),
    ).toBeNull();
    expect(
      resolveDashboardLayoutRedirect({
        hasSession: true,
        role: 'CUSTOMER',
        pathname: '/dashboard/finanzas',
      }),
    ).toBe('/catalog');
  });

  it('canoniza aliases del dashboard a la ruta oficial', () => {
    expect(resolveCanonicalDashboardPath('/dashboard/finance/opex')).toBe(
      '/dashboard/finanzas/opex',
    );
    expect(resolveCanonicalDashboardPath('/dashboard/logistics/suppliers')).toBe(
      '/dashboard/logistica/insumos',
    );
    expect(resolveCanonicalDashboardPath('/dashboard/finanzas')).toBeNull();
  });

  it('usa fallback no privilegiado cuando no se puede resolver el rol', () => {
    expect(getDashboardRoleFallback()).toBe('CUSTOMER');
  });

  it('redirecciona desde proxy segun acceso al dashboard', () => {
    expect(
      resolveProxyAccess({
        pathname: '/dashboard',
        hasUser: false,
        role: 'CUSTOMER',
        requestedRedirect: null,
      }),
    ).toBe('/login');

    expect(
      resolveProxyAccess({
        pathname: '/dashboard',
        hasUser: true,
        role: null,
        requestedRedirect: null,
      }),
    ).toBeNull();

    expect(
      resolveProxyAccess({
        pathname: '/dashboard/reportes',
        hasUser: true,
        role: 'MANAGER',
        requestedRedirect: null,
      }),
    ).toBe('/dashboard');

    expect(
      resolveProxyAccess({
        pathname: '/dashboard/customers',
        hasUser: true,
        role: 'MANAGER',
        requestedRedirect: null,
      }),
    ).toBe('/dashboard');

    expect(
      resolveProxyAccess({
        pathname: '/dashboard/personalizaciones',
        hasUser: true,
        role: 'MANAGER',
        requestedRedirect: null,
      }),
    ).toBeNull();

    expect(
      resolveProxyAccess({
        pathname: '/login',
        hasUser: true,
        role: 'ADMIN',
        requestedRedirect: null,
      }),
    ).toBe('/dashboard');
  });

  it('respeta redirects seguros despues del login', () => {
    expect(
      resolvePostLoginRedirectPath({
        role: 'CUSTOMER',
        requestedRedirect: '/checkout',
      }),
    ).toBe('/checkout');

    expect(
      resolvePostLoginRedirectPath({
        role: 'CUSTOMER',
        requestedRedirect: '/dashboard',
      }),
    ).toBe('/profile');

    expect(
      resolveProxyAccess({
        pathname: '/login',
        hasUser: true,
        role: 'CUSTOMER',
        requestedRedirect: '/checkout',
      }),
    ).toBe('/checkout');
  });

  it('usa el destino de perfil correcto para roles internos', () => {
    expect(getProfileNavigationPath('ADMIN')).toBe('/dashboard');
    expect(getProfileNavigationPath('MANAGER')).toBe('/dashboard');
    expect(getProfileNavigationPath('CUSTOMER')).toBe('/profile');
  });

  it('sincroniza visibilidad de rutas con el rol interno', () => {
    expect(canAccessDashboardPath('ADMIN', '/dashboard/settings')).toBe(true);
    expect(canAccessDashboardPath('MANAGER', '/dashboard/settings')).toBe(
      false,
    );
    expect(canAccessDashboardPath('MANAGER', '/dashboard/logistica/envios')).toBe(
      true,
    );
    expect(
      canAccessDashboardPath('MANAGER', '/dashboard/logistica/proveedores'),
    ).toBe(true);
    expect(
      canAccessDashboardPath('MANAGER', '/dashboard/logistica/inventario'),
    ).toBe(false);
    expect(
      canAccessDashboardPath('MANAGER', '/dashboard/compras/recepcion'),
    ).toBe(false);
    expect(
      canAccessDashboardPath('MANAGER', '/dashboard/personalizaciones'),
    ).toBe(true);
    expect(canAccessDashboardPath('CUSTOMER', '/dashboard/orders')).toBe(false);
    expect(canAccessDashboardPath('CUSTOMER', '/dashboard/products')).toBe(
      false,
    );
    expect(canAccessDashboardPath('CUSTOMER', '/dashboard/customers')).toBe(
      false,
    );
    expect(canAccessDashboardPath('CUSTOMER', '/dashboard/pqrs')).toBe(false);
  });

  it('ya no expone roles de solo lectura dedicados', () => {
    expect(isDashboardReadOnlyRole('ADMIN')).toBe(false);
    expect(isDashboardReadOnlyRole('MANAGER')).toBe(false);
    expect(isDashboardReadOnlyRole('CUSTOMER')).toBe(false);
  });
});
