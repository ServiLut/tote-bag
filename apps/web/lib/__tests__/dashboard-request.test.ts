import { DASHBOARD_REQUEST_PATH_HEADER_NAME, resolveDashboardRequestPath } from '../dashboard-request';

describe('dashboard request helpers', () => {
  it('usa la subruta real reenviada por el proxy', () => {
    const headers = new Headers({
      [DASHBOARD_REQUEST_PATH_HEADER_NAME]: '/dashboard/settings/users',
    });

    expect(resolveDashboardRequestPath(headers)).toBe(
      '/dashboard/settings/users',
    );
  });

  it('hace fallback cuando el header no existe o no es seguro', () => {
    expect(resolveDashboardRequestPath(new Headers())).toBe('/dashboard');
    expect(
      resolveDashboardRequestPath(
        new Headers({
          [DASHBOARD_REQUEST_PATH_HEADER_NAME]: '//evil.example/path',
        }),
      ),
    ).toBe('/dashboard');
    expect(
      resolveDashboardRequestPath(
        new Headers({
          [DASHBOARD_REQUEST_PATH_HEADER_NAME]: '/profile',
        }),
      ),
    ).toBe('/dashboard');
  });
});
