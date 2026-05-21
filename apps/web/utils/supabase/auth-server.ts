import { createClient } from './server';
import { cookies } from 'next/headers';
import {
  buildDashboardDebugRoleHeader,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

/**
 * Safely gets the current session on the server.
 * This version is intended for Server Components and Server Actions.
 */
export async function getSafeSession() {
  const supabase = await createClient();
  
  // We use getUser() to satisfy security warnings and trigger token refresh if needed.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return { session: null, error: userError };
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  return { session, error: sessionError };
}

/**
 * Reads the debug role header from cookies on the server.
 */
export async function getDashboardDebugRoleHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const debugRoleCookie = cookieStore.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value;

  const debugRole = parseDashboardDebugRoleCookie(
    debugRoleCookie ? decodeURIComponent(debugRoleCookie) : null,
  );

  return buildDashboardDebugRoleHeader(debugRole);
}

/**
 * Standalone helper to get Authorization headers on the server.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { session } = await getSafeSession();

  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    ...(await getDashboardDebugRoleHeader()),
  };
}
