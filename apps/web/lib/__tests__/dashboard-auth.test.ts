import {
  buildDashboardAuthHeaders,
  buildDashboardDebugRoleHeader,
  canUseDashboardDebugRole,
  extractDebugRoleAllowedFromProfilePayload,
  extractRoleFromProfilePayload,
  getDashboardRoleForOperatorEmail,
} from '../dashboard-auth';

describe('dashboard auth', () => {
  it('extrae el rol desde distintos formatos de payload', () => {
    expect(extractRoleFromProfilePayload({ role: 'ADMIN' })).toBe('ADMIN');
    expect(extractRoleFromProfilePayload({ user: { role: 'MANAGER' } })).toBe(
      'MANAGER',
    );
    expect(
      extractRoleFromProfilePayload({ data: { user: { role: 'VIEWER' } } }),
    ).toBe('MANAGER');
  });

  it('devuelve null cuando no hay rol en el payload', () => {
    expect(extractRoleFromProfilePayload({})).toBeNull();
    expect(extractRoleFromProfilePayload(null)).toBeNull();
  });

  it('resuelve roles operativos por correo como fallback del dashboard', () => {
    expect(getDashboardRoleForOperatorEmail('deybisasprilla@gmail.co')).toBe(
      'ADMIN',
    );
    expect(getDashboardRoleForOperatorEmail('admin@tote-bag.com')).toBeNull();
    expect(getDashboardRoleForOperatorEmail('cliente@example.com')).toBeNull();
  });

  it('lee si el backend habilito el selector QA', () => {
    expect(
      extractDebugRoleAllowedFromProfilePayload({
        data: { debugRoleAllowed: true },
      }),
    ).toBe(true);
    expect(extractDebugRoleAllowedFromProfilePayload({})).toBe(false);
  });

  it('deshabilita el selector QA fuera de desarrollo o sin permiso backend', () => {
    expect(canUseDashboardDebugRole(true, 'production')).toBe(false);
    expect(canUseDashboardDebugRole(false, 'development')).toBe(false);
    expect(canUseDashboardDebugRole(true, 'development')).toBe(true);
  });

  it('construye headers de debug role y auth para SSR y cliente', () => {
    expect(buildDashboardDebugRoleHeader(null)).toEqual({});
    expect(buildDashboardDebugRoleHeader('MANAGER')).toEqual({
      'x-debug-role': 'MANAGER',
    });
    expect(buildDashboardAuthHeaders('token-123', 'CUSTOMER')).toEqual({
      Authorization: 'Bearer token-123',
      'x-debug-role': 'CUSTOMER',
    });
  });
});
