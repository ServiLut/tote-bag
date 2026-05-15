export const DASHBOARD_REQUEST_PATH_HEADER_NAME =
  'x-tote-bag-dashboard-pathname';

export function resolveDashboardRequestPath(
  headers: Pick<Headers, 'get'>,
  fallback = '/dashboard',
) {
  const forwardedPath = headers.get(DASHBOARD_REQUEST_PATH_HEADER_NAME)?.trim();

  if (
    forwardedPath &&
    forwardedPath.startsWith('/dashboard') &&
    !forwardedPath.startsWith('//')
  ) {
    return forwardedPath;
  }

  return fallback;
}
