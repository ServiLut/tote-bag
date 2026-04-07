import { NextRequest, NextResponse } from 'next/server';
import { getApiCandidates } from '@/lib/api-config';
import {
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  const debugRole = parseDashboardDebugRoleCookie(
    request.cookies.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value,
  );

  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  if (debugRole) {
    headers.set(DASHBOARD_DEBUG_ROLE_HEADER_NAME, debugRole);
  }

  return headers;
}

async function forwardRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const pathname = path.join('/');
  const query = request.nextUrl.search;
  const headers = buildForwardHeaders(request);
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();

  let lastError: unknown;

  for (const baseUrl of getApiCandidates()) {
    try {
      const upstreamResponse = await fetch(`${baseUrl}/${pathname}${query}`, {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
      });

      const responseHeaders = new Headers(upstreamResponse.headers);
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('transfer-encoding');

      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'Sin detalle adicional';

  return NextResponse.json(
    { message: `No fue posible conectar con la API. Detalle: ${detail}` },
    { status: 502 },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return forwardRequest(request, context);
}
