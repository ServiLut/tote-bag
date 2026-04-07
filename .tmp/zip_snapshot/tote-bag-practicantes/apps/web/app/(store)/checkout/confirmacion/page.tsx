'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Package, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export default function CheckoutConfirmationPage() {
  return (
    <Suspense fallback={<ConfirmationSkeleton />}>
      <CheckoutConfirmationContent />
    </Suspense>
  );
}

function CheckoutConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center gap-8 px-4 py-12 md:px-6">
      <section className="rounded-[2rem] border border-theme bg-surface p-8 shadow-sm md:p-10">
        <div className="inline-flex rounded-2xl bg-emerald-50 p-4 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">
            Confirmacion de checkout
          </p>
          <h1 className="text-3xl font-black tracking-tight text-primary md:text-4xl">
            Tu orden fue registrada.
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-muted">
            El pago queda sujeto a confirmacion de la pasarela. Si el cobro se aprueba, el equipo
            continuara con preparacion y despacho.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Package className="h-5 w-5" />}
            title="Orden creada"
            description={orderId ? `Referencia interna: ${orderId}` : 'Conserva el comprobante del checkout para soporte.'}
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Pago en revision"
            description="La confirmacion final depende de la pasarela y del estado reportado al comercio."
          />
          <InfoCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="Siguiente paso"
            description="Recibiras confirmacion del equipo cuando el pedido pase a preparacion o despacho."
          />
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/profile"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-[0.14em] text-base-color"
          >
            Ver mi perfil
          </Link>
          <Link
            href="/catalog"
            className="inline-flex items-center justify-center rounded-2xl border border-theme px-5 py-3 text-sm font-bold text-primary"
          >
            Seguir comprando
          </Link>
        </div>
      </section>
    </main>
  );
}

function ConfirmationSkeleton() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-4xl flex-col justify-center gap-8 px-4 py-12 md:px-6">
      <section className="rounded-[2rem] border border-theme bg-surface p-8 shadow-sm md:p-10">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50" />
        <div className="mt-6 space-y-3">
          <div className="h-3 w-40 rounded bg-base/60" />
          <div className="h-10 w-72 rounded bg-base/60" />
          <div className="h-5 w-full max-w-2xl rounded bg-base/60" />
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-theme bg-base/40 p-5">
      <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
      <h2 className="mt-4 text-lg font-black text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}
