import { apiFetch } from '@/utils/api';

export type PaymentSupportEntityType =
  | 'order'
  | 'b2b'
  | 'batch'
  | 'purchase-invoice';

type SupportUrlResponse = {
  signedUrl?: unknown;
  url?: unknown;
  data?: {
    signedUrl?: unknown;
    url?: unknown;
  };
};

type SupportUrlFetcher = (
  path: string,
  init?: RequestInit,
) => Promise<Pick<Response, 'ok' | 'json'>>;

export function isDirectSupportUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function extractSupportUrl(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as SupportUrlResponse;
  const directUrl =
    typeof candidate.signedUrl === 'string'
      ? candidate.signedUrl
      : typeof candidate.url === 'string'
        ? candidate.url
        : null;

  if (directUrl) {
    return directUrl;
  }

  if (!candidate.data || typeof candidate.data !== 'object') {
    return null;
  }

  if (typeof candidate.data.signedUrl === 'string') {
    return candidate.data.signedUrl;
  }

  if (typeof candidate.data.url === 'string') {
    return candidate.data.url;
  }

  return null;
}

export async function resolvePaymentSupportUrl(options: {
  initialUrl?: string | null;
  entityId: string;
  entityType: PaymentSupportEntityType;
  accessToken?: string | null;
  fetchImpl?: SupportUrlFetcher;
}) {
  const {
    initialUrl,
    entityId,
    entityType,
    accessToken,
    fetchImpl = apiFetch,
  } = options;

  if (!initialUrl) {
    return null;
  }

  if (isDirectSupportUrl(initialUrl)) {
    return initialUrl;
  }

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetchImpl(
      `/payments/supports/${entityType}/${entityId}/signed-url`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null);
    return extractSupportUrl(payload);
  } catch {
    return null;
  }
}
