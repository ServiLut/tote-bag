import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

type SignedUploadPayload = {
  path?: unknown;
  token?: unknown;
  publicUrl?: unknown;
  previewUrl?: unknown;
  storageRef?: unknown;
  data?: {
    path?: unknown;
    token?: unknown;
    publicUrl?: unknown;
    previewUrl?: unknown;
    storageRef?: unknown;
  };
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.message)) {
      return record.message.join(', ');
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (typeof record.error === 'string') {
      return record.error;
    }
  }

  return fallback;
}

function extractSignedUploadPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as SignedUploadPayload;
  const nested = record.data && typeof record.data === 'object' ? record.data : null;
  const path =
    typeof record.path === 'string'
      ? record.path
      : typeof nested?.path === 'string'
        ? nested.path
        : null;
  const token =
    typeof record.token === 'string'
      ? record.token
      : typeof nested?.token === 'string'
        ? nested.token
        : null;
  const publicUrl =
    typeof record.publicUrl === 'string'
      ? record.publicUrl
      : typeof nested?.publicUrl === 'string'
        ? nested.publicUrl
        : null;
  const previewUrl =
    typeof record.previewUrl === 'string'
      ? record.previewUrl
      : typeof nested?.previewUrl === 'string'
        ? nested.previewUrl
        : null;
  const storageRef =
    typeof record.storageRef === 'string'
      ? record.storageRef
      : typeof nested?.storageRef === 'string'
        ? nested.storageRef
        : null;

  if (!path || !token) {
    return null;
  }

  return { path, token, publicUrl, previewUrl, storageRef };
}

export type PersonalizationDesignUploadResult = {
  storageRef: string;
  previewUrl: string | null;
};

export async function uploadPersonalizationDesign(file: File) {
  const signedUploadResponse = await apiFetch('/personalizations/signed-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    }),
  });

  const signedUploadBody = await signedUploadResponse.json().catch(() => null);
  if (!signedUploadResponse.ok) {
    throw new Error(
      getErrorMessage(
        signedUploadBody,
        `No se pudo preparar la carga del diseno (${signedUploadResponse.status}).`,
      ),
    );
  }

  const signedUpload = extractSignedUploadPayload(signedUploadBody);
  if (!signedUpload) {
    throw new Error('La API no devolvio una carga firmada valida para el diseno.');
  }

  const supabase = createClient();
  const { error } = await supabase.storage
    .from('custom-designs')
    .uploadToSignedUrl(signedUpload.path, signedUpload.token, file, {
      contentType: file.type || 'application/octet-stream',
    });

  if (error) {
    throw new Error(error.message || 'No se pudo subir el diseno.');
  }

  if (!signedUpload.storageRef) {
    throw new Error('La API no devolvio la referencia privada del diseno.');
  }

  return {
    storageRef: signedUpload.storageRef,
    previewUrl: signedUpload.previewUrl ?? null,
  } satisfies PersonalizationDesignUploadResult;
}
