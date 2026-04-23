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

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function getLoopbackCandidatesForConfiguredUrl(configuredApiUrl: string) {
  try {
    const url = new URL(configuredApiUrl);
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      !isPrivateIpv4(url.hostname)
    ) {
      return [];
    }

    const port = url.port ? `:${url.port}` : '';
    const path = url.pathname.replace(/\/$/, '');
    return [
      `${url.protocol}//localhost${port}${path}`,
      `${url.protocol}//127.0.0.1${port}${path}`,
    ];
  } catch {
    return [];
  }
}

export function getApiCandidates() {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    if (process.env.NODE_ENV === 'production') {
      return [configuredApiUrl];
    }

    return Array.from(
      new Set([
        ...getLoopbackCandidatesForConfiguredUrl(configuredApiUrl),
        configuredApiUrl,
        ...LOCAL_API_CANDIDATES,
      ]),
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

export function extractApiConnectionErrorTargets(message: string) {
  const match = message.match(/URLs probadas:\s*(.+?)\.\s*Detalle:/i);
  if (!match) {
    return [];
  }

  return Array.from(
    new Set(
      match[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try {
            const url = new URL(value);
            return url.host;
          } catch {
            return value;
          }
        }),
    ),
  );
}
