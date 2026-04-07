'use client';

import { CheckCircle, Factory, ShieldCheck, Zap } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { useTranslation } from 'react-i18next';

export default function CorporativoPage() {
  const { t } = useTranslation();
  const WHATSAPP_URL =
    'https://wa.me/573014472558?text=Hola,%20me%20interesa%20informaci%C3%B3n%20sobre%20pedidos%20corporativos.';

  return (
    <div className="bg-base min-h-screen transition-colors duration-300">
      <section className="bg-primary px-4 py-24 text-white sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="mb-6 text-4xl font-serif md:text-6xl">{t('corporate_hero_title')}</h1>
          <p className="mx-auto max-w-3xl text-xl font-light leading-relaxed opacity-90">
            {t('corporate_hero_description')}
          </p>
          <div className="mt-10">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full bg-green-500 px-10 py-4 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-green-600"
            >
              <WhatsAppIcon className="h-8 w-8 text-white" />
              {t('corporate_talk_advisor')}
            </a>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          <div className="space-y-4 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Factory size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">{t('corporate_custom_title')}</h3>
            <p className="leading-relaxed text-muted">{t('corporate_custom_description')}</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">{t('corporate_quality_title')}</h3>
            <p className="leading-relaxed text-muted">{t('corporate_quality_description')}</p>
          </div>
          <div className="space-y-4 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Zap size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">{t('corporate_timing_title')}</h3>
            <p className="leading-relaxed text-muted">{t('corporate_timing_description')}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-theme bg-white py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="mb-8 text-3xl font-serif text-primary">{t('corporate_cta_title')}</h2>
          <div className="flex flex-col items-center rounded-3xl border border-theme bg-slate-50 p-10">
            <p className="mb-8 text-lg text-muted">{t('corporate_cta_description')}</p>
            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center gap-3 text-sm font-bold text-primary">
                <CheckCircle className="text-green-500" size={20} />
                {t('corporate_volume_discount')}
              </div>
              <div className="flex items-center gap-3 text-sm font-bold text-primary">
                <CheckCircle className="text-green-500" size={20} />
                {t('corporate_samples')}
              </div>
              <div className="flex items-center gap-3 text-sm font-bold text-primary">
                <CheckCircle className="text-green-500" size={20} />
                {t('corporate_design_advice')}
              </div>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-12 inline-flex items-center gap-3 rounded-full bg-green-500 px-8 py-4 font-bold uppercase tracking-widest text-white transition-all hover:scale-[1.02] hover:bg-green-600"
            >
              {t('corporate_start_conversation')} <WhatsAppIcon className="h-6 w-6 text-white" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
