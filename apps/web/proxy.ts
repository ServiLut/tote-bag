import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

type DashboardRole = 'ADMIN' | 'MANAGER' | 'ADVISOR' | 'VIEWER' | 'CUSTOMER';

async function getRoleFromApi(
  apiUrl: string,
  accessToken: string,
): Promise<DashboardRole | null> {
  try {
    const res = await fetch(`${apiUrl}/profiles/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const body = (await res.json()) as {
      data?: {
        user?: {
          role?: DashboardRole;
        };
      };
    };

    return body?.data?.user?.role ?? null;
  } catch {
    return null;
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
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshing the auth token
  const { 
    data: { user }, 
  } = await supabase.auth.getUser();
  let role: DashboardRole = 'CUSTOMER';

  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const roleFromApi = await getRoleFromApi(
        process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1',
        session.access_token,
      );
      role = roleFromApi ?? 'CUSTOMER';
    }
  }

  // Protected routes logic
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');
  const isFinancePage = request.nextUrl.pathname.startsWith('/dashboard/finanzas') || 
                        request.nextUrl.pathname.startsWith('/dashboard/finance') ||
                        request.nextUrl.pathname.startsWith('/dashboard/reportes');
  const isSettingsPage = request.nextUrl.pathname.startsWith('/dashboard/settings') ||
                         request.nextUrl.pathname.startsWith('/dashboard/audit');

  // 1. If trying to access dashboard but not logged in -> login
  if (isDashboardPage && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. If logged in and trying to access auth pages -> redirect based on role
  if (isAuthPage && user) {
    if (role === 'ADMIN' || role === 'MANAGER' || role === 'ADVISOR') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/profile', request.url));
  }

  // 3. Role-based access control for Dashboard
  if (isDashboardPage) {
    // CUSTOMER cannot access dashboard
    if (role === 'CUSTOMER') {
      return NextResponse.redirect(new URL('/profile', request.url));
    }

    // MANAGER cannot access Finance or Settings/Audit
    if (role === 'MANAGER' && (isFinancePage || isSettingsPage)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
