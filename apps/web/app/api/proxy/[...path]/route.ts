import { NextRequest, NextResponse } from 'next/server';
import {
  getServerApiCandidates,
  isRetryableApiResponseStatus,
} from '@/lib/api-config';
import {
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_HEADER_NAME,
  parseDashboardDebugRoleCookie,
} from '@/lib/dashboard-auth';

const PROXY_SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_PROXY_TIMEOUT_MS = 30_000;

function getProxyRequestTimeoutMs() {
  const rawValue = process.env.API_PROXY_TIMEOUT_MS?.trim();

  if (!rawValue) {
    return DEFAULT_PROXY_TIMEOUT_MS;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_PROXY_TIMEOUT_MS;
}

function getRequestMethod(request: NextRequest) {
  return request.method.toUpperCase();
}

function canReplayProxyRequest(request: NextRequest, headers: Headers) {
  return (
    PROXY_SAFE_RETRY_METHODS.has(getRequestMethod(request)) ||
    headers.has('x-idempotency-key')
  );
}

function buildForwardedForHeader(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  if (forwardedFor && realIp) {
    return forwardedFor
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .concat(realIp)
      .filter((value, index, values) => values.indexOf(value) === index)
      .join(', ');
  }

  return forwardedFor ?? realIp ?? null;
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const debugRole = parseDashboardDebugRoleCookie(
    request.cookies.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value,
  );

  for (const name of [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'user-agent',
    'x-idempotency-key',
  ]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  const forwardedFor = buildForwardedForHeader(request);
  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }

  const forwardedProto =
    request.headers.get('x-forwarded-proto') ??
    request.nextUrl.protocol.replace(/:$/, '');
  if (forwardedProto) {
    headers.set('x-forwarded-proto', forwardedProto);
  }

  const forwardedHost =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  if (forwardedHost) {
    headers.set('x-forwarded-host', forwardedHost);
  }

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
  const requestTimeoutMs = getProxyRequestTimeoutMs();
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
  const canReplayRequest = canReplayProxyRequest(request, headers);

  let lastError: unknown;
  const attemptedUrls: string[] = [];

  for (const baseUrl of getServerApiCandidates()) {
    const targetUrl = `${baseUrl}/${pathname}${query}`;
    attemptedUrls.push(targetUrl);

    try {
      if (pathname.startsWith('shipping/')) {
        console.log(
          `[api/proxy] ${request.method} ${pathname} -> ${targetUrl} auth=${headers.has('authorization')}`,
        );
      }
      const upstreamResponse = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (
        canReplayRequest &&
        isRetryableApiResponseStatus(upstreamResponse.status)
      ) {
        await upstreamResponse.body?.cancel().catch(() => undefined);
        lastError = new Error(
          `API candidate ${targetUrl} returned transient status ${upstreamResponse.status}`,
        );
        continue;
      }

      if (pathname.startsWith('shipping/')) {
        console.log(
          `[api/proxy] ${request.method} ${pathname} <- ${upstreamResponse.status} from ${targetUrl}`,
        );
      }

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

      if (!canReplayRequest) {
        break;
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'Sin detalle adicional';

  return NextResponse.json(
    {
      message: `No fue posible conectar con la API. URLs probadas: ${attemptedUrls.join(', ')}. Detalle: ${detail}`,
    },
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
