import { createClient } from './client';
import {
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

/**
 * Safely gets the current session by first calling getUser() to satisfy
 * security warnings and ensure the token is refreshed if necessary.
 */
export async function getSafeSession() {
  const supabase = createClient();
  
  // We use getUser() to satisfy security warnings and trigger token refresh if needed.
  // This is the recommended way to verify the user's identity.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { session: null, error: userError };
  }

  // Now we can safely get the session for the access_token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  return { session, error: sessionError };
}

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

  if (!debugRole) {
    return {};
  }

  return {
    [DASHBOARD_DEBUG_ROLE_HEADER_NAME]: debugRole,
  };
}

/**
 * Standalone helper to get Authorization headers safely
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
