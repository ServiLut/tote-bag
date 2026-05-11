import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient';
import { ThemeProvider } from '@/components/theme-provider';
import {
  buildDashboardAuthHeaders,
  extractDashboardRoleContextFromProfilePayload,
  getDashboardRoleForOperatorEmail,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  readForwardedDashboardRoleContext,
  parseDashboardDebugRoleCookie,
  type DashboardRoleContext,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { getServerApiCandidates } from '@/lib/api-config';
import {
  resolveDashboardLayoutRedirect,
} from '@/lib/frontend-routing';

const DASHBOARD_PATHNAME_HEADER_NAME = 'x-tote-bag-pathname';

async function getCurrentRoleContext(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRoleContext> {
  for (const apiUrl of getServerApiCandidates()) {
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
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const pathname =
    requestHeaders.get(DASHBOARD_PATHNAME_HEADER_NAME) ?? '/dashboard';
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
    redirect(sessionRedirect ?? `/login?redirect=${encodeURIComponent(pathname)}`);
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
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <main className="flex min-h-screen items-center justify-center bg-base px-6 py-10 text-primary">
          <div className="w-full max-w-lg rounded-3xl border border-theme bg-surface p-8 shadow-xl shadow-black/5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-muted">
              Dashboard
            </p>
            <h1 className="mt-3 text-2xl font-black tracking-tight">
              No fue posible validar tus permisos
            </h1>
            <p className="mt-3 text-sm font-medium text-muted">
              Tu sesion sigue activa, pero la validacion del rol interno no estuvo
              disponible. Reintenta la carga del modulo antes de volver a iniciar
              sesion.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={pathname}
                className="rounded-2xl bg-primary px-5 py-3 text-sm font-black text-base-color transition-opacity hover:opacity-90"
              >
                Reintentar modulo
              </a>
              <a
                href="/profile"
                className="rounded-2xl border border-theme px-5 py-3 text-sm font-black text-primary transition-colors hover:border-primary/30 hover:text-primary"
              >
                Ir a perfil
              </a>
            </div>
          </div>
        </main>
      </ThemeProvider>
    );
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
