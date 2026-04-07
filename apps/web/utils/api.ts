export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';
}

export function apiFetch(path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return fetch(`${getApiBaseUrl()}${normalizedPath}`, init);
}
