'use client';

import { useState } from 'react';
import { Upload, Paperclip, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/cn';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';

interface ReceiptUploadProps {
  entityId: string;
  entityType: 'order' | 'b2b' | 'batch';
  initialUrl?: string | null;
  onUploadSuccess?: (url: string) => void;
  className?: string;
  mode?: 'card' | 'button';
  disabled?: boolean;
}

export function ReceiptUpload({
  entityId,
  entityType,
  initialUrl,
  onUploadSuccess,
  className,
  mode = 'card',
  disabled = false,
}: ReceiptUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert('Sesión expirada');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch(`/payments/upload-receipt/${entityType}/${entityId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || 'Error al subir comprobante');
      }

      const data = await res.json();
      const url = data.url || data.data?.url;
      
      setCurrentUrl(url);
      if (onUploadSuccess) onUploadSuccess(url);
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {mode === 'card' ? (
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase text-muted tracking-widest flex items-center gap-2">
            <Paperclip className="w-3 h-3" /> Comprobante de Pago
          </label>
          {currentUrl && (
            <a 
              href={currentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-secondary hover:underline flex items-center gap-1"
            >
              Ver Actual <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      ) : null}

      <div className="relative group">
        <input
          type="file"
          id={`receipt-upload-${entityId}`}
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading || disabled}
          accept="image/*,.pdf"
        />
        <label
          htmlFor={`receipt-upload-${entityId}`}
          className={cn(
            mode === 'button'
              ? "inline-flex items-center justify-center gap-2 rounded-lg border border-theme bg-base px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer transition-all hover:bg-primary hover:text-base-color"
              : "flex items-center justify-center gap-3 w-full p-4 rounded-2xl border-2 border-dashed border-theme bg-base/30 cursor-pointer transition-all hover:bg-base/50 hover:border-primary/30 group-hover:scale-[1.01]",
            (uploading || disabled) && "opacity-50",
            uploading ? "cursor-wait" : disabled ? "cursor-not-allowed" : null,
            currentUrl &&
              (mode === 'button'
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white"
                : "border-emerald-500/30 bg-emerald-500/5")
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {mode === 'button' ? <span>Subiendo</span> : null}
            </>
          ) : currentUrl ? (
            <>
              <CheckCircle2 className={cn("w-4 h-4", mode === 'button' ? '' : "text-emerald-500")} />
              <span className={cn(mode === 'button' ? '' : "text-xs font-bold text-emerald-600")}>
                {mode === 'button' ? 'Cambiar Comprobante' : 'Cambiar Comprobante'}
              </span>
            </>
          ) : (
            <>
              <Upload className={cn("w-4 h-4", mode === 'button' ? '' : "text-muted group-hover:text-primary transition-colors")} />
              <span className={cn(mode === 'button' ? '' : "text-xs font-bold text-muted group-hover:text-primary transition-colors")}>
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
            Ver <ExternalLink className="w-3 h-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

