'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { buildStorefrontWhatsAppUrl } from '@/lib/whatsapp';

type ProductErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProductError({ error, reset }: ProductErrorProps) {
  useEffect(() => {
    console.error('Catalog product route error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-20">
      <section className="rounded-[2rem] border border-theme bg-surface p-8 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted">
          Producto temporalmente no disponible
        </p>
        <h1 className="mt-4 text-3xl font-serif text-primary">
          No pudimos cargar esta referencia
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          Puedes reintentar o hablar con un asesor para confirmar disponibilidad, tiempos o una opcion similar.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-base-color"
          >
            Reintentar
          </button>
          <Link
            href="/catalog"
            className="rounded-xl border border-theme px-5 py-3 text-sm font-bold text-primary transition-colors hover:bg-base"
          >
            Ver catalogo
          </Link>
          <Link
            href={buildStorefrontWhatsAppUrl('product')}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-green-500 px-5 py-3 text-sm font-bold text-green-700 transition-colors hover:bg-green-50"
          >
            Consultar por WhatsApp
          </Link>
        </div>
      </section>
    </main>
  );
}
