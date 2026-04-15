import { Role } from '../../generated/client/enums';
import {
  PROTECTED_ADMIN_EMAILS,
  WHITELISTED_OPERATOR_EMAILS,
} from '../constants/whitelisted-operator-emails';

export function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function isProtectedAdminEmail(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  return !!normalizedEmail && PROTECTED_ADMIN_EMAILS.has(normalizedEmail);
}

export function getProtectedAdminRoleForEmail(email?: string | null) {
  return isProtectedAdminEmail(email) ? Role.ADMIN : null;
}

export function getOperatorRoleForEmail(email?: string | null) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  if (PROTECTED_ADMIN_EMAILS.has(normalizedEmail)) {
    return Role.ADMIN;
  }

  if (WHITELISTED_OPERATOR_EMAILS.has(normalizedEmail)) {
    return Role.MANAGER;
  }

  return null;
}

export function applyProtectedAdminRole<
  T extends { email?: string | null; role?: Role | null },
>(record: T) {
  return isProtectedAdminEmail(record.email)
    ? {
        ...record,
        role: Role.ADMIN,
      }
    : record;
}
