'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, RefreshCcw, ShieldCheck, Truck } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { buildStorefrontWhatsAppUrl } from '@/lib/whatsapp';
import { COMPANY_INFO } from '@/utils/company-info';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
    <div className="rounded-3xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-2xl bg-primary/8 p-3 text-primary">
        {icon}
      </div>
      <h2 className="text-xl font-black text-primary">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
    </div>
  );
}

export default function ShippingInfoPage() {
  const { t } = useTranslation();

  return (
    <div className="bg-base">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
        <section className="overflow-hidden rounded-[2rem] border border-theme bg-surface shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6 p-8 md:p-10">
              <span className="inline-flex items-center rounded-full border border-theme bg-base px-4 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-muted">
                {t('shipping_support_badge')}
              </span>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-serif font-bold tracking-tight text-primary md:text-5xl">
                  {t('shipping_title')}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted">
                  {t('shipping_description')}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-theme bg-base/60 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">{t('shipping_dispatch')}</p>
                  <p className="mt-2 text-lg font-black text-primary">{t('shipping_dispatch_value')}</p>
                </div>
                <div className="rounded-2xl border border-theme bg-base/60 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">{t('shipping_coverage')}</p>
                  <p className="mt-2 text-lg font-black text-primary">{t('shipping_coverage_value')}</p>
                </div>
                <div className="rounded-2xl border border-theme bg-base/60 px-4 py-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">{t('shipping_support')}</p>
                  <p className="mt-2 text-lg font-black text-primary">{t('shipping_support_value')}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-primary p-8 text-base-color md:p-10">
              <div className="space-y-6">
                <div className="inline-flex rounded-2xl bg-base-color/10 p-4">
                  <Truck className="h-8 w-8" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-black">{t('shipping_questions_title')}</h2>
                  <p className="text-sm leading-7 text-base-color/80">{t('shipping_questions_description')}</p>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <Link
                  href={buildStorefrontWhatsAppUrl('shipping')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#25D366] px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition-all hover:scale-[1.01] hover:bg-[#20ba57] active:scale-95"
                >
                  <WhatsAppIcon className="h-5 w-5 text-white" />
                  {t('shipping_talk_advisor')}
                </Link>
                <p className="text-xs text-base-color/70">
                  {t('shipping_support_whatsapp', { phone: COMPANY_INFO.phone })}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={<Clock3 className="h-5 w-5" />} title={t('shipping_times_title')} description={t('shipping_times_description')} />
          <InfoCard icon={<PackageCheck className="h-5 w-5" />} title={t('shipping_tracking_title')} description={t('shipping_tracking_description')} />
          <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title={t('shipping_packaging_title')} description={t('shipping_packaging_description')} />
          <InfoCard icon={<RefreshCcw className="h-5 w-5" />} title={t('shipping_returns_title')} description={t('shipping_returns_description')} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
            <h2 className="text-2xl font-black text-primary">{t('shipping_system_title')}</h2>
            <div className="mt-6 space-y-5">
              {[t('shipping_system_step_1'), t('shipping_system_step_2'), t('shipping_system_step_3'), t('shipping_system_step_4')].map((step, index) => (
                <div key={step} className="flex gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-base-color">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-7 text-muted">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
            <h2 className="text-2xl font-black text-primary">{t('shipping_policy_title')}</h2>
            <ul className="mt-6 space-y-4 text-sm leading-7 text-muted">
              {[t('shipping_policy_item_1'), t('shipping_policy_item_2'), t('shipping_policy_item_3')].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            <Link href="/pqrs" className="mt-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-primary transition-opacity hover:opacity-70">
              {t('shipping_go_pqrs')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
