const DEBUG_ROLE_HEADER = 'x-debug-role';

const AVAILABLE_DEBUG_ROLES = [
  'ADMIN',
  'MANAGER',
  'CUSTOMER',
] as const;

export type DebugRole = (typeof AVAILABLE_DEBUG_ROLES)[number];

export const DEBUG_ROLE_ALLOWED_EMAILS = new Set([
  'deybisasprilla@gmail.com',
  'admin@tote-bag.com',
]);

export function getDebugRoleHeaderName() {
  return DEBUG_ROLE_HEADER;
}

export function isDebugRole(value: unknown): value is DebugRole {
  return (
    typeof value === 'string' &&
    AVAILABLE_DEBUG_ROLES.includes(value as DebugRole)
  );
}

export function getDebugRoleFromHeader(value: unknown): DebugRole | null {
  if (Array.isArray(value)) {
    return getDebugRoleFromHeader(value[0]);
  }

  return isDebugRole(value) ? value : null;
}

export function getAvailableDebugRoles(): readonly DebugRole[] {
  return AVAILABLE_DEBUG_ROLES;
}

export function canUseDebugRole(email?: string | null, nodeEnv?: string) {
  if (nodeEnv === 'development') {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  return !!normalizedEmail && DEBUG_ROLE_ALLOWED_EMAILS.has(normalizedEmail);
}
