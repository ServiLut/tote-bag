import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  extractRoleFromProfilePayload,
  parseDashboardDebugRoleCookie,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { resolveProxyAccess } from '@/lib/frontend-routing';
import { getApiBaseUrl } from '@/utils/api';

async function getRoleFromApi(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRole | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/profiles/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(debugRole ? { [DASHBOARD_DEBUG_ROLE_HEADER_NAME]: debugRole } : {}),
      },
      cache: 'no-store',
    });

    if (!res.ok) return debugRole ?? null;

    const body = await res.json();
    return extractRoleFromProfilePayload(body) ?? debugRole ?? null;
  } catch {
    return debugRole ?? null;
  }
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: DashboardRole | null = null;
  const debugRole = parseDashboardDebugRoleCookie(
    request.cookies.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value,
  );

  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      role = await getRoleFromApi(session.access_token, debugRole);
    }
  }

  const redirectPath = resolveProxyAccess({
    pathname: request.nextUrl.pathname,
    hasUser: !!user,
    role,
    requestedRedirect: request.nextUrl.searchParams.get('redirect'),
  });
  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
