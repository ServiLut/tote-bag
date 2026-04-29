import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { ThemeProvider } from '@/components/theme-provider';
import {
  buildDashboardAuthHeaders,
  extractDashboardRoleContextFromProfilePayload,
  getDashboardRoleForOperatorEmail,
  getApiCandidates,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  readForwardedDashboardRoleContext,
  parseDashboardDebugRoleCookie,
  type DashboardRoleContext,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import {
  resolveDashboardLayoutRedirect,
} from '@/lib/frontend-routing';

async function getCurrentRoleContext(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRoleContext> {
  for (const apiUrl of getApiCandidates()) {
    try {
      const res = await fetch(`${apiUrl}/profiles/me`, {
        cache: 'no-store',
        headers: buildDashboardAuthHeaders(accessToken, debugRole),
      });

      if (!res.ok) continue;

      const body = await res.json();
      return extractDashboardRoleContextFromProfilePayload(body);
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
  const requestHeaders = await headers();
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

  const forwardedRoleContext = readForwardedDashboardRoleContext(requestHeaders);
  const roleContext = forwardedRoleContext.resolved
    ? forwardedRoleContext
    : await getCurrentRoleContext(session.access_token, debugRole);
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
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <DashboardLayoutClient
        userEmail={session.user.email}
        role={role}
        debugRoleAllowed={roleContext.debugRoleAllowed}
        accessToken={session.access_token}
      >
        {children}
      </DashboardLayoutClient>
    </ThemeProvider>
  );
}
