'use client';

import { useEffect } from 'react';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Unhandled application error', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="es">
      <body className="bg-base text-body">
        <main className="min-h-screen flex items-center justify-center px-6 py-16">
          <section className="w-full max-w-xl rounded-2xl border border-theme bg-surface p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted">
              Error
            </p>
            <h1 className="mt-4 text-3xl font-bold text-primary">
              Ocurrio un problema inesperado
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              La aplicacion encontro un error no controlado. Puedes reintentar
              la operacion o volver a cargar la pagina.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-sm bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-base-color"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-sm border border-theme px-5 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary"
              >
                Recargar
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
