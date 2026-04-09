import {
  getApiCandidates,
  isRetryableApiResponseStatus,
} from '@/lib/api-config';

export async function apiFetch(path: string, init?: RequestInit) {
  if (typeof window !== 'undefined') {
    return fetch(`/api/proxy${path}`, init);
  }

  let lastError: unknown;
  const attemptedUrls: string[] = [];

  for (const baseUrl of getApiCandidates()) {
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
