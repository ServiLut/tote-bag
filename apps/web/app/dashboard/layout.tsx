import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import {
  extractRoleFromProfilePayload,
  getApiCandidates,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  getLockedDashboardRoleForEmail,
  parseDashboardDebugRoleCookie,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import {
  getDashboardRoleFallback,
  resolveDashboardLayoutRedirect,
} from '@/lib/frontend-routing';

async function getCurrentRole(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRole | null> {
  for (const apiUrl of getApiCandidates()) {
    try {
      const res = await fetch(`${apiUrl}/profiles/me`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(debugRole
            ? {
                'x-debug-role': debugRole,
              }
            : {}),
        },
      });

      if (!res.ok) continue;

      const body = await res.json();
      const role = extractRoleFromProfilePayload(body);
      if (role) {
        return role;
      }
    } catch {
      continue;
    }
  }

  return debugRole ?? null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = '/dashboard';
  const cookieStore = await cookies();
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const lockedRole = getLockedDashboardRoleForEmail(session?.user.email);
  const debugRole = lockedRole
    ? null
    : parseDashboardDebugRoleCookie(
        cookieStore.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value,
      );

  const sessionRedirect = resolveDashboardLayoutRedirect({
    hasSession: !!session,
    role: null,
    pathname,
  });
  if (sessionRedirect) {
    redirect(sessionRedirect);
  }

  if (!session) {
    redirect('/login');
  }

  const role =
    lockedRole ?? (await getCurrentRole(session.access_token, debugRole)) ?? null;

  const roleRedirect = resolveDashboardLayoutRedirect({
    hasSession: true,
    role,
    pathname,
  });
  if (roleRedirect) {
    redirect(roleRedirect);
  }

  const effectiveRole = role ?? getDashboardRoleFallback();

  return (
    <DashboardLayoutClient
      userEmail={session.user.email}
      role={effectiveRole}
      accessToken={session.access_token}
    >
      {children}
    </DashboardLayoutClient>
  );
}
