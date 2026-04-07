'use client';

import { createClient } from '@/utils/supabase/client';
import {
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.split('=').slice(1).join('='));
}

export async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {};

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const debugRole = parseDashboardDebugRoleCookie(
    getCookieValue(DASHBOARD_DEBUG_ROLE_COOKIE_NAME),
  );

  if (debugRole) {
    headers[DASHBOARD_DEBUG_ROLE_HEADER_NAME] = debugRole;
  }

  return headers;
}
