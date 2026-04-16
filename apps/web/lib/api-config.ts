const LOCAL_API_CANDIDATES = [
  'http://localhost:4005/api/v1',
  'http://127.0.0.1:4005/api/v1',
  'http://localhost:4003/api/v1',
  'http://127.0.0.1:4003/api/v1',
  'http://localhost:4004/api/v1',
  'http://127.0.0.1:4004/api/v1',
  'http://localhost:4001/api/v1',
  'http://127.0.0.1:4001/api/v1',
  'http://localhost:4000/api/v1',
  'http://127.0.0.1:4000/api/v1',
] as const;

const RETRYABLE_API_RESPONSE_STATUSES = new Set([502, 503, 504]);

export function getApiCandidates() {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    if (process.env.NODE_ENV === 'production') {
      return [configuredApiUrl];
    }

    return Array.from(
      new Set([configuredApiUrl, ...LOCAL_API_CANDIDATES]),
    ) as string[];
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[api-config] NEXT_PUBLIC_API_URL is required in production.',
    );
  }

  return [...LOCAL_API_CANDIDATES];
}

export function getApiBaseUrl() {
  return getApiCandidates()[0] ?? LOCAL_API_CANDIDATES[0];
}

export function isRetryableApiResponseStatus(status: number) {
  return RETRYABLE_API_RESPONSE_STATUSES.has(status);
}
