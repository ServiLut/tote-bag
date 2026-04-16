import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  extractRoleFromProfilePayload,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  getApiCandidates,
  parseDashboardDebugRoleCookie,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { tryGetSupabaseEnv } from '@/lib/env';
import { resolveProxyAccess } from '@/lib/frontend-routing';

async function getRoleFromApi(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRole | null> {
  for (const apiUrl of getApiCandidates()) {
    try {
      const res = await fetch(`${apiUrl}/profiles/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(debugRole
            ? {
                [DASHBOARD_DEBUG_ROLE_HEADER_NAME]: debugRole,
              }
            : {}),
        },
        cache: 'no-store',
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

  return null;
}

export async function proxy(request: NextRequest) {
  const env = tryGetSupabaseEnv();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!env) {
    const redirectPath = resolveProxyAccess({
      pathname: request.nextUrl.pathname,
      hasUser: false,
      role: null,
      requestedRedirect: request.nextUrl.searchParams.get('redirect'),
    });

    return redirectPath
      ? NextResponse.redirect(new URL(redirectPath, request.url))
      : response;
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
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
  });

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
