import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import {
  extractRoleFromProfilePayload,
  extractDebugRoleAllowedFromProfilePayload,
  getDashboardRoleForOperatorEmail,
  getApiCandidates,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  parseDashboardDebugRoleCookie,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import {
  resolveDashboardLayoutRedirect,
} from '@/lib/frontend-routing';

async function getCurrentRoleContext(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<{ role: DashboardRole | null; debugRoleAllowed: boolean }> {
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
        return {
          role,
          debugRoleAllowed: extractDebugRoleAllowedFromProfilePayload(body),
        };
      }
    } catch {
      continue;
    }
  }

  return { role: null, debugRoleAllowed: false };
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
  const debugRole = parseDashboardDebugRoleCookie(
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

  const roleContext = await getCurrentRoleContext(
    session.access_token,
    debugRole,
  );
  const role =
    roleContext.role ?? getDashboardRoleForOperatorEmail(session.user.email);

  const roleRedirect = resolveDashboardLayoutRedirect({
    hasSession: true,
    role,
    pathname,
  });
  if (roleRedirect) {
    redirect(roleRedirect);
  }

  if (!role) {
    redirect('/login?redirect=/dashboard');
  }

  return (
    <DashboardLayoutClient
      userEmail={session.user.email}
      role={role}
      debugRoleAllowed={roleContext.debugRoleAllowed}
      accessToken={session.access_token}
    >
      {children}
    </DashboardLayoutClient>
  );
}
