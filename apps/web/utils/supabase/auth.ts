import { createClient } from './client';
import {
  buildDashboardDebugRoleHeader,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

/**
 * Safely gets the current session in the browser.
 * This version is intended for Client Components.
 */
export async function getSafeSession() {
  const supabase = createClient();
  
  // We use getUser() to satisfy security warnings and trigger token refresh if needed.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { session: null, error: userError };
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  return { session, error: sessionError };
}

/**
 * Reads the debug role header from document.cookie.
 * Safe for Client Components (returns empty object during SSR).
 */
export function getDashboardDebugRoleHeader(): Record<string, string> {
  if (typeof document === 'undefined') {
    return {};
  }

  const debugRoleCookie = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${DASHBOARD_DEBUG_ROLE_COOKIE_NAME}=`))
    ?.split('=')[1];

  const debugRole = parseDashboardDebugRoleCookie(
    debugRoleCookie ? decodeURIComponent(debugRoleCookie) : null,
  );

  return buildDashboardDebugRoleHeader(debugRole);
}

/**
 * Standalone helper to get Authorization headers in the browser.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { session } = await getSafeSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    ...getDashboardDebugRoleHeader(),
  };
}
