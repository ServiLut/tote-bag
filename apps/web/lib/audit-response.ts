export interface AuditLogRecord {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  payload: Record<string, unknown> | null;
  previousData: Record<string, unknown> | null;
  userId: string | null;
  user?: {
    email: string;
    profile?: {
      firstName: string | null;
      lastName: string | null;
    } | null;
  } | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditMeta {
  total: number;
  skip: number;
  take: number;
}

export interface AuditResponseShape {
  logs: AuditLogRecord[];
  meta: AuditMeta | null;
}

function isAuditMeta(value: unknown): value is AuditMeta {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.total === 'number' &&
    typeof candidate.skip === 'number' &&
    typeof candidate.take === 'number'
  );
}

function isAuditPayloadContainer(
  value: unknown,
): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeAuditResponse(body: unknown): AuditResponseShape {
  if (isAuditPayloadContainer(body)) {
    const rootData = 'data' in body ? (body as { data?: unknown }).data : null;
    const rootMeta = 'meta' in body ? (body as { meta?: unknown }).meta : null;

    if (Array.isArray(rootData)) {
      return {
        logs: rootData as AuditLogRecord[],
        meta: isAuditMeta(rootMeta) ? rootMeta : null,
      };
    }
  }

  const payload =
    isAuditPayloadContainer(body) && 'data' in body
      ? (body as { data?: unknown }).data
      : body;

  if (Array.isArray(payload)) {
    return {
      logs: payload as AuditLogRecord[],
      meta: null,
    };
  }

  if (!isAuditPayloadContainer(payload)) {
    return {
      logs: [],
      meta: null,
    };
  }

  const nestedData = 'data' in payload ? (payload as { data?: unknown }).data : null;
  const nestedMeta = 'meta' in payload ? (payload as { meta?: unknown }).meta : null;

  if (Array.isArray(nestedData)) {
    return {
      logs: nestedData as AuditLogRecord[],
      meta: isAuditMeta(nestedMeta) ? nestedMeta : null,
    };
  }

  return {
    logs: [],
    meta: isAuditMeta(nestedMeta) ? nestedMeta : null,
  };
}
