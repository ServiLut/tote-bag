import { getApiCandidates as getSharedApiCandidates } from '@/lib/api-config';

export type DashboardRole = 'ADMIN' | 'MANAGER' | 'CUSTOMER';

export const DASHBOARD_DEBUG_ROLE_COOKIE_NAME = 'dashboard_debug_role';
export const DASHBOARD_DEBUG_ROLE_HEADER_NAME = 'x-debug-role';
export const DASHBOARD_DEBUG_ROLE_ALLOWED_EMAILS = [
  'deybisasprilla@gmail.com',
  'admin@tote-bag.com',
] as const;

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

export function isDashboardReadOnlyRole(
  _role: DashboardRole | null | undefined,
) {
  return false;
}

export function canUseDashboardDebugRole(
  email: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  if (nodeEnv === 'development') {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  return !!normalizedEmail && DASHBOARD_DEBUG_ROLE_ALLOWED_EMAILS.includes(
    normalizedEmail as (typeof DASHBOARD_DEBUG_ROLE_ALLOWED_EMAILS)[number],
  );
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
