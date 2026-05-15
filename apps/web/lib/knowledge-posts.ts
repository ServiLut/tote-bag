import { apiFetch } from '@/utils/api';
import { getApiResponseErrorMessage } from '@/lib/api-error';

export const KNOWLEDGE_CATEGORIES = [
  'GENERAL',
  'VENTAS',
  'NOTICIAS',
  'OPERACION',
  'FINANZAS',
  'ESTRATEGIA',
] as const;

export const KNOWLEDGE_STATUSES = [
  'BORRADOR',
  'PUBLICADO',
  'ARCHIVADO',
] as const;

export const KNOWLEDGE_PRIORITIES = [
  'BAJA',
  'MEDIA',
  'ALTA',
  'CRITICA',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];
export type KnowledgePriority = (typeof KNOWLEDGE_PRIORITIES)[number];

export interface KnowledgePostAuthor {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CUSTOMER';
}

export interface KnowledgeAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface KnowledgePost {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  imageUrls: string[];
  attachments?: KnowledgeAttachment[] | null;
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  priority: KnowledgePriority;
  tags: string[];
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: KnowledgePostAuthor | null;
}

export interface KnowledgePostsListResponse {
  items: KnowledgePost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KnowledgePostsQuery {
  search?: string;
  category?: KnowledgeCategory | '';
  status?: KnowledgeStatus | '';
  priority?: KnowledgePriority | '';
  page?: number;
  limit?: number;
}

export interface KnowledgePostPayload {
  title: string;
  slug?: string;
  summary?: string;
  content: string;
  imageUrls: string[];
  attachments: KnowledgeAttachment[];
  category: KnowledgeCategory;
  status: KnowledgeStatus;
  priority: KnowledgePriority;
  tags: string[];
  publishedAt?: string | null;
}

function buildAuthHeaders(token: string, includeJson = false) {
  return {
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

function buildKnowledgePostsQueryString(query: KnowledgePostsQuery) {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  if (query.category) {
    params.set('category', query.category);
  }

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.priority) {
    params.set('priority', query.priority);
  }

  if (query.page) {
    params.set('page', String(query.page));
  }

  if (query.limit) {
    params.set('limit', String(query.limit));
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listKnowledgePosts(
  token: string,
  query: KnowledgePostsQuery,
) {
  const response = await apiFetch(
    `/knowledge-posts${buildKnowledgePostsQueryString(query)}`,
    {
      headers: buildAuthHeaders(token),
    },
  );

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible cargar las publicaciones del centro informativo.',
        'Centro Informativo',
      ),
    );
  }

  const body = (await response.json()) as {
    data?: KnowledgePostsListResponse;
  };

  return (
    body.data ?? {
      items: [],
      total: 0,
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      totalPages: 1,
    }
  );
}

export async function createKnowledgePost(
  token: string,
  payload: KnowledgePostPayload,
) {
  const response = await apiFetch('/knowledge-posts', {
    method: 'POST',
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible crear la publicacion.',
        'Centro Informativo',
      ),
    );
  }

  const body = (await response.json()) as { data: KnowledgePost };
  return body.data;
}

export async function updateKnowledgePost(
  token: string,
  id: string,
  payload: KnowledgePostPayload,
) {
  const response = await apiFetch(`/knowledge-posts/${id}`, {
    method: 'PATCH',
    headers: buildAuthHeaders(token, true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible actualizar la publicacion.',
        'Centro Informativo',
      ),
    );
  }

  const body = (await response.json()) as { data: KnowledgePost };
  return body.data;
}

export async function deleteKnowledgePost(token: string, id: string) {
  const response = await apiFetch(`/knowledge-posts/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible eliminar la publicacion.',
        'Centro Informativo',
      ),
    );
  }
}

export async function uploadKnowledgePostImage(token: string, file: File) {
  const body = new FormData();
  body.append('file', file);

  const response = await apiFetch('/knowledge-posts/upload-image', {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body,
  });

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible subir la imagen de la publicacion.',
        'Centro Informativo',
      ),
    );
  }

  const payload = (await response.json()) as {
    data?: { url?: string };
    url?: string;
  };

  return payload.data?.url ?? payload.url ?? null;
}

export async function uploadKnowledgePostAttachment(token: string, file: File) {
  const body = new FormData();
  body.append('file', file);

  const response = await apiFetch('/knowledge-posts/upload-attachment', {
    method: 'POST',
    headers: buildAuthHeaders(token),
    body,
  });

  if (!response.ok) {
    throw new Error(
      await getApiResponseErrorMessage(
        response,
        'No fue posible subir el archivo adjunto.',
        'Centro Informativo',
      ),
    );
  }

  const payload = (await response.json()) as {
    data?: KnowledgeAttachment & { path?: string };
  };

  if (!payload.data?.url || !payload.data?.name) {
    return null;
  }

  return {
    name: payload.data.name,
    url: payload.data.url,
    ...(payload.data.mimeType ? { mimeType: payload.data.mimeType } : {}),
    ...(typeof payload.data.size === 'number' ? { size: payload.data.size } : {}),
  };
}
