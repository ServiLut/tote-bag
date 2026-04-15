import { Role } from '../../generated/client/enums';
import { isProtectedAdminEmail } from './protected-admin.util';

export const DEBUG_ROLE_HEADER = 'x-debug-role';
export const DEBUG_ROLE_ALLOWED_EMAILS = new Set([
  'deybisasprilla@gmail.com',
  'admin@tote-bag.com',
]);

const AVAILABLE_DEBUG_ROLES = Object.values(Role);

export function isDebugRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && AVAILABLE_DEBUG_ROLES.includes(value as Role)
  );
}

export function getDebugRoleFromHeader(value: unknown): Role | null {
  if (Array.isArray(value)) {
    return getDebugRoleFromHeader(value[0]);
  }

  return isDebugRole(value) ? value : null;
}

export function getAvailableDebugRoles(): Role[] {
  return [...AVAILABLE_DEBUG_ROLES];
}

export function canUseDebugRole(email?: string | null, nodeEnv?: string) {
  if (isProtectedAdminEmail(email)) {
    return false;
  }

  if (nodeEnv === 'development') {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  return !!normalizedEmail && DEBUG_ROLE_ALLOWED_EMAILS.has(normalizedEmail);
}
