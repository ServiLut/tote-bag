import { getApiCandidates as getSharedApiCandidates } from '@/lib/api-config';

export type DashboardRole = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

export const DASHBOARD_DEBUG_ROLE_COOKIE_NAME = 'dashboard_debug_role';
export const DASHBOARD_DEBUG_ROLE_HEADER_NAME = 'x-debug-role';

export const DASHBOARD_DEBUG_ROLE_OPTIONS: readonly DashboardRole[] = [
  'ADMIN',
  'MANAGER',
  'CUSTOMER',
];

const DASHBOARD_ROLE_LABELS: Record<DashboardRole, string> = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CUSTOMER: 'CUSTOMER',
};

const PROTECTED_DASHBOARD_ADMIN_EMAILS = new Set([
  'deybisasprilla@gmail.co',
  'deybisasprilla@gmail.com',
]);

const DASHBOARD_OPERATOR_EMAILS = new Set([
  'admin@tote-bag.com',
  'deybisasprilla@gmail.co',
  'deybisasprilla@gmail.com',
]);

export function normalizeDashboardRole(role: unknown): DashboardRole | null {
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'CUSTOMER') {
    return role;
  }

  if (role === 'VIEWER' || role === 'ADVISOR') {
    return 'MANAGER';
  }

  return null;
}

export function parseDashboardDebugRoleCookie(value: string | null | undefined) {
  return normalizeDashboardRole(value);
}

export function buildDashboardDebugRoleHeader(
  debugRole: DashboardRole | null | undefined,
): Record<string, string> {
  if (!debugRole) {
    return {};
  }

  return {
    [DASHBOARD_DEBUG_ROLE_HEADER_NAME]: debugRole,
  };
}

export function buildDashboardAuthHeaders(
  accessToken: string,
  debugRole: DashboardRole | null | undefined,
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...buildDashboardDebugRoleHeader(debugRole),
  };
}

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

export function getDashboardRoleForOperatorEmail(
  email: string | null | undefined,
): DashboardRole | null {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  if (PROTECTED_DASHBOARD_ADMIN_EMAILS.has(normalizedEmail)) {
    return 'ADMIN';
  }

  if (DASHBOARD_OPERATOR_EMAILS.has(normalizedEmail)) {
    return 'MANAGER';
  }

  return null;
}

export function getDashboardRoleLabel(role: DashboardRole | null | undefined) {
  if (!role) {
    return 'CUSTOMER';
  }

  return DASHBOARD_ROLE_LABELS[role] ?? role;
}

export function isDashboardPrivilegedRole(
  role: DashboardRole | null | undefined,
): role is Exclude<DashboardRole, 'CUSTOMER'> {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function canUseDashboardDebugRole(
  debugRoleAllowed: boolean | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  return nodeEnv === 'development' && debugRoleAllowed === true;
}

export function getApiCandidates() {
  return getSharedApiCandidates();
}

export function extractRoleFromProfilePayload(body: unknown): DashboardRole | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const payload = body as {
    role?: DashboardRole;
    user?: { role?: DashboardRole };
    data?: {
      role?: DashboardRole;
      user?: { role?: DashboardRole };
    };
  };

  return normalizeDashboardRole(
    payload?.data?.user?.role ??
      payload?.data?.role ??
      payload?.user?.role ??
      payload?.role ??
      null,
  );
}

export function extractDebugRoleAllowedFromProfilePayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const payload = body as {
    debugRoleAllowed?: unknown;
    data?: {
      debugRoleAllowed?: unknown;
    };
  };

  return (
    payload?.data?.debugRoleAllowed === true ||
    payload?.debugRoleAllowed === true
  );
}
