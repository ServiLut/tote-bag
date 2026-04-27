import { ApiResponse } from '@/types/api';

export type CatalogProductFetchResult<T> =
  | { kind: 'found'; product: T }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export async function resolveCatalogProductResponse<T>(
  response: Response,
): Promise<CatalogProductFetchResult<T>> {
  if (response.status === 404) {
    return { kind: 'missing' };
  }

  if (!response.ok) {
    return { kind: 'unavailable' };
  }

  const body = (await response.json()) as ApiResponse<T>;
  return {
    kind: 'found',
    product: body.data,
  };
}
