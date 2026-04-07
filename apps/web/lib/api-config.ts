const DEFAULT_API_CANDIDATES = [
  process.env.NEXT_PUBLIC_API_URL,
  process.env.API_URL,
  'http://127.0.0.1:4003/api/v1',
  'http://localhost:4003/api/v1',
];

function normalizeApiUrl(value: string) {
  return value.replace(/\/+$/, '');
}

export function getApiCandidates() {
  const uniqueCandidates = new Set<string>();

  for (const candidate of DEFAULT_API_CANDIDATES) {
    if (!candidate) {
      continue;
    }

    uniqueCandidates.add(normalizeApiUrl(candidate));
  }

  return Array.from(uniqueCandidates);
}

export function getApiBaseUrl() {
  return getApiCandidates()[0] ?? 'http://127.0.0.1:4003/api/v1';
}
