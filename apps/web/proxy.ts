import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import {
  buildDashboardAuthHeaders,
  buildForwardedDashboardRoleContextHeaders,
  DASHBOARD_DEBUG_ROLE_ALLOWED_HEADER_NAME,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_ROLE_CONTEXT_RESOLVED_HEADER_NAME,
  DASHBOARD_ROLE_HEADER_NAME,
  extractDashboardRoleContextFromProfilePayload,
  parseDashboardDebugRoleCookie,
  type DashboardRoleContext,
  type DashboardRole,
} from '@/lib/dashboard-auth';
import { getServerApiCandidates } from '@/lib/api-config';
import { tryGetSupabaseEnv } from '@/lib/env';
import { resolveProxyAccess } from '@/lib/frontend-routing';

const DASHBOARD_PATHNAME_HEADER_NAME = 'x-tote-bag-pathname';

async function getRoleContextFromApi(
  accessToken: string,
  debugRole: DashboardRole | null,
): Promise<DashboardRoleContext | null> {
  for (const apiUrl of getServerApiCandidates()) {
    try {
      const res = await fetch(`${apiUrl}/profiles/me`, {
        headers: buildDashboardAuthHeaders(accessToken, debugRole),
        cache: 'no-store',
      });

      if (!res.ok) continue;

      const body = await res.json();
      return extractDashboardRoleContextFromProfilePayload(body);
    } catch {
      continue;
    }
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const env = tryGetSupabaseEnv();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DASHBOARD_PATHNAME_HEADER_NAME, request.nextUrl.pathname);
  const pendingCookies: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse['cookies']['set']>[2];
  }> = [];
  requestHeaders.delete(DASHBOARD_ROLE_CONTEXT_RESOLVED_HEADER_NAME);
  requestHeaders.delete(DASHBOARD_ROLE_HEADER_NAME);
  requestHeaders.delete(DASHBOARD_DEBUG_ROLE_ALLOWED_HEADER_NAME);

  const buildResponse = (kind: 'next' | 'redirect', redirectUrl?: URL) => {
    const nextResponse =
      kind === 'redirect' && redirectUrl
        ? NextResponse.redirect(redirectUrl)
        : NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

    pendingCookies.forEach(({ name, value, options }) =>
      nextResponse.cookies.set(name, value, options),
    );

    return nextResponse;
  };

  if (!env) {
    const redirectPath = resolveProxyAccess({
      pathname: request.nextUrl.pathname,
      hasUser: false,
      role: null,
      requestedRedirect: request.nextUrl.searchParams.get('redirect'),
    });

    return redirectPath
      ? buildResponse('redirect', new URL(redirectPath, request.url))
      : buildResponse('next');
  }

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesBatch) {
        cookiesBatch.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesBatch.forEach(({ name, value, options }) => {
          const existingCookieIndex = pendingCookies.findIndex(
            (cookie) => cookie.name === name,
          );

          if (existingCookieIndex >= 0) {
            pendingCookies[existingCookieIndex] = {
              name,
              value,
              options,
            };
            return;
          }

          pendingCookies.push({
            name,
            value,
            options,
          });
        });
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
      const roleContext = await getRoleContextFromApi(
        session.access_token,
        debugRole,
      );
      if (roleContext) {
        role = roleContext.role;

        for (const [name, value] of Object.entries(
          buildForwardedDashboardRoleContextHeaders(roleContext),
        )) {
          requestHeaders.set(name, value);
        }
      }
    }
  }

  const redirectPath = resolveProxyAccess({
    pathname: request.nextUrl.pathname,
    hasUser: !!user,
    role,
    requestedRedirect: request.nextUrl.searchParams.get('redirect'),
  });
  if (redirectPath) {
    return buildResponse('redirect', new URL(redirectPath, request.url));
  }

  return buildResponse('next');
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
