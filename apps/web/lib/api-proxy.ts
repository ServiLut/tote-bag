export type RetryableProxyResponseSnapshot = {
  status: number;
  statusText: string;
  headers: Headers;
  body: ArrayBuffer;
};

const ALLOWED_PROXY_HEADERS = new Set([
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'user-agent',
  'x-request-id',
  'x-idempotency-key',
  'x-event-checksum',
  'x-correlation-id',
]);

const BLOCKED_PROXY_HEADERS = new Set([
  'host',
  'cookie',
  'set-cookie',
  'connection',
  'upgrade',
  'proxy-authorization',
]);

export function sanitizeProxyHeaders(originalHeaders: Headers): Headers {
  const safeHeaders = new Headers();
  
  originalHeaders.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (ALLOWED_PROXY_HEADERS.has(lowerKey) && !BLOCKED_PROXY_HEADERS.has(lowerKey)) {
      safeHeaders.set(lowerKey, value);
    }
  });

  return safeHeaders;
}

export function sanitizeProxyResponseHeaders(headers: Headers) {
  const responseHeaders = new Headers(headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('transfer-encoding');
  return responseHeaders;
}

export async function captureRetryableProxyResponse(response: Response) {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: sanitizeProxyResponseHeaders(response.headers),
    body: await response.arrayBuffer(),
  } satisfies RetryableProxyResponseSnapshot;
}

export function buildProxyConnectionFailureMessage(
  attemptedUrls: string[],
  lastError: unknown,
) {
  const detail =
    lastError instanceof Error ? lastError.message : 'Sin detalle adicional';

  return `No fue posible conectar con la API. URLs probadas: ${attemptedUrls.join(', ')}. Detalle: ${detail}`;
}

export function buildFinalProxyResponse(input: {
  attemptedUrls: string[];
  lastError: unknown;
  lastRetryableResponse: RetryableProxyResponseSnapshot | null;
}) {
  if (input.lastRetryableResponse) {
    return new Response(input.lastRetryableResponse.body, {
      status: input.lastRetryableResponse.status,
      statusText: input.lastRetryableResponse.statusText,
      headers: input.lastRetryableResponse.headers,
    });
  }

  return Response.json(
    {
      message: buildProxyConnectionFailureMessage(
        input.attemptedUrls,
        input.lastError,
      ),
    },
    { status: 502 },
  );
}

export function buildForwardedProxyResponse(response: Response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: sanitizeProxyResponseHeaders(response.headers),
  });
}
