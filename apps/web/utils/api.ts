import {
  getServerApiCandidates,
  isRetryableApiResponseStatus,
} from '@/lib/api-config';

const BROWSER_PROXY_RETRY_DELAY_MS = 250;
const BROWSER_PROXY_RETRYABLE_METHODS = new Set(['GET', 'HEAD']);

function getRequestMethod(init?: RequestInit) {
  return (init?.method ?? 'GET').toUpperCase();
}

function canRetryBrowserProxyRequest(init?: RequestInit) {
  return BROWSER_PROXY_RETRYABLE_METHODS.has(getRequestMethod(init));
}

function createAbortError() {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

async function waitForRetry(delayMs: number, signal?: AbortSignal | null) {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return;
  }

  if (signal.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

async function fetchWithBrowserProxyRetry(path: string, init?: RequestInit) {
  const proxyPath = `/api/proxy${path}`;
  const shouldRetry = canRetryBrowserProxyRequest(init);
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(proxyPath, init);

      if (
        shouldRetry &&
        attempt === 0 &&
        isRetryableApiResponseStatus(response.status)
      ) {
        await response.body?.cancel().catch(() => undefined);
        attempt += 1;
        await waitForRetry(BROWSER_PROXY_RETRY_DELAY_MS, init?.signal);
        continue;
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      if (!shouldRetry || attempt > 0) {
        throw error;
      }

      attempt += 1;
      await waitForRetry(BROWSER_PROXY_RETRY_DELAY_MS, init?.signal);
    }
  }
}

export async function apiFetch(path: string, init?: RequestInit) {
  if (typeof window !== 'undefined') {
    return fetchWithBrowserProxyRetry(path, init);
  }

  let lastError: unknown;
  const attemptedUrls: string[] = [];

  for (const baseUrl of getServerApiCandidates()) {
    const url = `${baseUrl}${path}`;
    attemptedUrls.push(url);
    try {
      const response = await fetch(url, init);

      if (isRetryableApiResponseStatus(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        lastError = new Error(
          `API candidate ${url} returned transient status ${response.status}`,
        );
        continue;
      }

      // If we got a response, it means we reached A server.
      // We should return it and let the caller handle it (even if not ok).
      // Retrying other ports only makes sense if the fetch ITSELF failed (network error).
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Fetch only throws on network errors (e.g. connection refused).
      // In this case, we continue to the next candidate.
      lastError = error;
    }
  }

  // If we reach here, it means NO candidate was reachable (all threw network errors).
  const detail =
    lastError instanceof Error ? lastError.message : 'Sin detalle adicional';

  throw new Error(
    `No fue posible conectar con la API. URLs probadas: ${attemptedUrls.join(', ')}. Detalle: ${detail}`,
  );
}
