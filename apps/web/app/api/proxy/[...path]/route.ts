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
import { sanitizeProxyResponseHeaders } from '@/lib/api-proxy';
import { logAuditRecord, logSystemAlert } from '@/lib/audit-log';

const PROXY_SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PROXY_MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getProxyRequestTimeoutMs(pathname: string) {
  if (pathname.startsWith('reports/')) return 45000;
  if (pathname.startsWith('uploads/')) return 30000;
  if (pathname.startsWith('finance/')) return 15000;
  if (pathname.startsWith('dashboard/')) return 12000;
  if (pathname.startsWith('checkout/') || pathname.startsWith('payment/')) return 8000;
  if (pathname.startsWith('catalog/')) return 6000;

  const rawValue = process.env.API_PROXY_TIMEOUT_MS?.trim();
  if (rawValue) {
    const parsedValue = Number(rawValue);
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }
  return 8000;
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

function buildForwardHeaders(request: NextRequest, requestId: string) {
  const headers = new Headers();
  const debugRole = parseDashboardDebugRoleCookie(
    request.cookies.get(DASHBOARD_DEBUG_ROLE_COOKIE_NAME)?.value,
  );

  // Sanitización estricta: solo pasar headers permitidos
  for (const name of [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'user-agent',
    'x-idempotency-key',
    'x-event-checksum',
    'x-correlation-id',
  ]) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set('x-request-id', requestId);

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

const ipRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimit.get(ip);
  if (!record || record.resetTime < now) {
    ipRateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

function secureLogProxy(level: 'info' | 'error', context: Record<string, unknown>) {
  const safeContext = {
    ...context,
    timestamp: new Date().toISOString(),
  };
  if (level === 'error') {
    console.error(`[API Proxy Error]`, JSON.stringify(safeContext));
  } else {
    console.info(`[API Proxy Info]`, JSON.stringify(safeContext));
  }
}

async function forwardRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  const { path } = await context.params;
  const pathname = path.join('/');
  const query = request.nextUrl.search;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  const headers = buildForwardHeaders(request, requestId);
  const requestTimeoutMs = getProxyRequestTimeoutMs(pathname);
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer();
  const canReplayRequest = canReplayProxyRequest(request, headers);

  let lastError: unknown;
  const attemptedUrls: string[] = [];
  const startTime = Date.now();

  for (const baseUrl of getServerApiCandidates()) {
    const targetUrl = `${baseUrl}/${pathname}${query}`;
    let safeTargetHost = 'unknown';
    try {
      safeTargetHost = new URL(baseUrl).host;
    } catch {
      safeTargetHost = baseUrl;
    }
    
    attemptedUrls.push(targetUrl);

    try {
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
          `API candidate ${safeTargetHost} returned transient status ${upstreamResponse.status}`,
        );
        continue;
      }

      if (!upstreamResponse.ok && upstreamResponse.status >= 500) {
         secureLogProxy('error', {
           requestId,
           path: pathname,
           method: request.method,
           status: upstreamResponse.status,
           elapsedMs: Date.now() - startTime,
           selectedTargetHost: safeTargetHost,
           errorType: 'UpstreamServerError'
         });

         await logSystemAlert('CRITICAL', `API Error ${upstreamResponse.status} on ${pathname}`, {
            requestId,
            method: request.method,
            targetHost: safeTargetHost
         });
      }

      // Auditoría automática para métodos mutantes
      if (upstreamResponse.ok && PROXY_MUTATING_METHODS.has(request.method.toUpperCase())) {
         const entity = pathname.split('/')[0] || 'unknown';
         await logAuditRecord({
            action: `${request.method.toUpperCase()}_AUTO`,
            entity,
            entityId: pathname.split('/')[1] || null,
            payload: { path: pathname, query },
            metadata: { source: 'api-proxy-auto' }
         }, requestId);
      }

      const responseHeaders = sanitizeProxyResponseHeaders(upstreamResponse.headers);
      responseHeaders.set('x-request-id', requestId);

      return new NextResponse(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error;
      const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
      
      secureLogProxy('error', {
        requestId,
        path: pathname,
        method: request.method,
        status: isTimeout ? 504 : 502,
        elapsedMs: Date.now() - startTime,
        selectedTargetHost: safeTargetHost,
        errorType: isTimeout ? 'TimeoutError' : 'NetworkError'
      });

      if (!canReplayRequest) {
        break;
      }
    }
  }

  const detail =
    lastError instanceof Error ? lastError.message : 'Sin detalle adicional';
  const isTimeoutError = lastError instanceof DOMException && lastError.name === 'TimeoutError';
  const finalStatus = isTimeoutError ? 504 : 502;

  return NextResponse.json(
    {
      message: `No fue posible conectar con la API. Detalle: ${detail}`,
      requestId,
    },
    { status: finalStatus, headers: { 'x-request-id': requestId } },
  );
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }
export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }
export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }
export async function HEAD(request: NextRequest, context: { params: Promise<{ path: string[] }> }) { return forwardRequest(request, context); }