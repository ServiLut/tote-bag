'use client';

import { useEffect, useState } from 'react';
import {
  Upload,
  Paperclip,
  Loader2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

type ReceiptUploadEntityType =
  | 'order'
  | 'order-payment'
  | 'b2b'
  | 'batch'
  | 'purchase-invoice'
  | 'purchase-payment';

interface ReceiptUploadProps {
  entityId: string;
  entityType: ReceiptUploadEntityType;
  initialUrl?: string | null;
  onUploadSuccess?: (url: string, storageRef?: string) => void;
  className?: string;
  mode?: 'card' | 'button';
  disabled?: boolean;
  deferUpload?: boolean;
  onFileSelected?: (file: File | null) => void;
  selectedFileName?: string | null;
}

function isDirectUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function extractResolvedUrl(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    signedUrl?: unknown;
    url?: unknown;
    data?: {
      signedUrl?: unknown;
      url?: unknown;
    };
  };

  if (typeof candidate.signedUrl === 'string') {
    return candidate.signedUrl;
  }

  if (typeof candidate.url === 'string') {
    return candidate.url;
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

function extractStorageRef(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    storageRef?: unknown;
    data?: {
      storageRef?: unknown;
    };
  };

  if (typeof candidate.storageRef === 'string') {
    return candidate.storageRef;
  }

  if (
    candidate.data &&
    typeof candidate.data === 'object' &&
    typeof candidate.data.storageRef === 'string'
  ) {
    return candidate.data.storageRef;
  }

  return null;
}

export function ReceiptUpload({
  entityId,
  entityType,
  initialUrl,
  onUploadSuccess,
  className,
  mode = 'card',
  disabled = false,
  deferUpload = false,
  onFileSelected,
  selectedFileName,
}: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(
    selectedFileName ?? null,
  );
  const supabase = createClient();

  useEffect(() => {
    setCurrentFileName(selectedFileName ?? null);
  }, [selectedFileName]);

  useEffect(() => {
    let active = true;

    const resolveInitialUrl = async () => {
      if (!initialUrl) {
        if (active) {
          setCurrentUrl(null);
        }
        return;
      }

      if (isDirectUrl(initialUrl)) {
        if (active) {
          setCurrentUrl(initialUrl);
        }
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          if (active) {
            setCurrentUrl(null);
          }
          return;
        }

        const response = await apiFetch(
          `/payments/supports/${entityType}/${entityId}/signed-url`,
          {
            cache: 'no-store',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!response.ok) {
          if (active) {
            setCurrentUrl(null);
          }
          return;
        }

        const payload = await response.json().catch(() => null);
        if (active) {
          setCurrentUrl(extractResolvedUrl(payload));
        }
      } catch {
        if (active) {
          setCurrentUrl(null);
        }
      }
    };

    void resolveInitialUrl();

    return () => {
      active = false;
    };
  }, [entityId, entityType, initialUrl, supabase.auth]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setCurrentFileName(file.name);

    if (deferUpload) {
      onFileSelected?.(file);
      return;
    }

    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert('Sesion expirada');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch(
        `/payments/upload-receipt/${entityType}/${entityId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || 'Error al subir comprobante');
      }

      const data = await res.json().catch(() => null);
      const resolvedUrl = extractResolvedUrl(data);
      const storageRef = extractStorageRef(data);

      if (!resolvedUrl && !storageRef) {
        throw new Error('La respuesta de subida no incluyo el comprobante');
      }

      setCurrentUrl(resolvedUrl);
      if (onUploadSuccess) {
        onUploadSuccess(resolvedUrl ?? storageRef ?? file.name, storageRef ?? undefined);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(
        error instanceof Error ? error.message : 'Error al subir el archivo',
      );
    } finally {
      setUploading(false);
    }
  };

  const hasFile = Boolean(currentUrl || currentFileName);

  return (
    <div className={cn('space-y-2', className)}>
      {mode === 'card' ? (
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
            <Paperclip className="h-3 w-3" /> Comprobante de Pago
          </label>
          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] font-bold text-secondary hover:underline"
            >
              Ver Actual <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="relative group">
        <input
          type="file"
          id={`receipt-upload-${entityType}-${entityId}`}
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || disabled}
          accept="image/*,.pdf"
        />
        <label
          htmlFor={`receipt-upload-${entityType}-${entityId}`}
          className={cn(
            mode === 'button'
              ? 'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-theme bg-base px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-base-color'
              : 'flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-theme bg-base/30 p-4 transition-all hover:border-primary/30 hover:bg-base/50 group-hover:scale-[1.01]',
            (uploading || disabled) && 'opacity-50',
            uploading ? 'cursor-wait' : disabled ? 'cursor-not-allowed' : null,
            hasFile &&
              (mode === 'button'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                : 'border-emerald-500/30 bg-emerald-500/5'),
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {mode === 'button' ? <span>Subiendo</span> : null}
            </>
          ) : hasFile ? (
            <>
              <CheckCircle2
                className={cn(
                  'h-4 w-4',
                  mode === 'button' ? '' : 'text-emerald-500',
                )}
              />
              <span
                className={cn(
                  mode === 'button' ? '' : 'text-xs font-bold text-emerald-600',
                )}
              >
                {currentUrl ? 'Cambiar Comprobante' : 'Archivo listo'}
              </span>
            </>
          ) : (
            <>
              <Upload
                className={cn(
                  'h-4 w-4',
                  mode === 'button'
                    ? ''
                    : 'text-muted transition-colors group-hover:text-primary',
                )}
              />
              <span
                className={cn(
                  mode === 'button'
                    ? ''
                    : 'text-xs font-bold text-muted transition-colors group-hover:text-primary',
                )}
              >
                {disabled
                  ? 'Solo lectura'
                  : mode === 'button'
                    ? 'Subir Comprobante'
                    : 'Subir PDF o Imagen'}
              </span>
            </>
          )}
        </label>
        {mode === 'button' && currentUrl ? (
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-secondary hover:underline"
          >
            Ver <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {currentFileName && !currentUrl ? (
        <p className="text-[11px] font-medium text-muted">
          Archivo listo: <span className="font-bold text-primary">{currentFileName}</span>
        </p>
      ) : null}
    </div>
  );
}
