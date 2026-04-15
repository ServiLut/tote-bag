import {
  canUseDashboardDebugRole,
  extractRoleFromProfilePayload,
  getLockedDashboardRoleForEmail,
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

  it('mantiene a la cuenta protegida como ADMIN sin selector QA', () => {
    expect(getLockedDashboardRoleForEmail(' DeybisAsprilla@gmail.com ')).toBe(
      'ADMIN',
    );
    expect(
      canUseDashboardDebugRole('deybisasprilla@gmail.com', 'development'),
    ).toBe(false);
  });
});
