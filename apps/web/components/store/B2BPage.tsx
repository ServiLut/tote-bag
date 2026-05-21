'use client';

import Link from 'next/link';
import { Building2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import B2BQuoteForm from '@/components/b2b/B2BQuoteForm';
import ImageCarousel from '@/components/b2b/ImageCarousel';
import { buildStorefrontWhatsAppUrl } from '@/lib/whatsapp';

export default function B2BPage() {
  const { t } = useTranslation();
  const processSteps = [
    t('b2b_process_step_1'),
    t('b2b_process_step_2'),
    t('b2b_process_step_3'),
    t('b2b_process_step_4'),
    t('b2b_process_step_5'),
    t('b2b_process_step_6'),
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch mb-16">
        <div className="flex flex-col space-y-10 animate-in slide-in-from-left duration-500">
          <div className="space-y-10">
            <div>
              <span className="inline-block px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
                {t('b2b_badge')}
              </span>
              <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight mb-6">
                {t('b2b_title_line_1')} <br /> {t('b2b_title_line_2')}
              </h1>
              <p className="text-lg text-muted leading-relaxed">{t('b2b_description_safe')}</p>
            </div>

            <div className="grid gap-8">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">{t('b2b_premium_title')}</h3>
                  <p className="text-sm text-muted">{t('b2b_premium_description_safe')}</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Building2 className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">{t('b2b_logistics_title')}</h3>
                  <p className="text-sm text-muted">{t('b2b_logistics_description_safe')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-[400px]">
            <div className="w-full flex-1 rounded-2xl overflow-hidden shadow-lg border border-theme bg-surface p-1 flex flex-col">
              <div className="relative w-full flex-1 bg-base rounded-xl overflow-hidden">
                <ImageCarousel />
              </div>
            </div>
          </div>
        </div>

        <div className="relative animate-in slide-in-from-right duration-500 delay-100 h-full">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-pulse pointer-events-none"></div>
          <B2BQuoteForm />
        </div>
      </div>

      <div className="space-y-16 animate-in fade-in duration-700 delay-200">
        <div className="rounded-[3rem] border border-theme bg-surface p-10 lg:p-16">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">{t('b2b_process_title')}</h2>
              <p className="text-lg text-muted">{t('b2b_process_description')}</p>
            </div>
            <Link
              href={buildStorefrontWhatsAppUrl('b2b')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-green-600 px-8 py-4 text-sm font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-green-700 hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-200"
            >
              {t('b2b_whatsapp_cta')}
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {processSteps.map((step, index) => (
              <div key={step} className="group relative rounded-3xl border border-theme bg-base p-8 hover:border-accent transition-all">
                <span className="absolute -top-3 -left-3 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-sm font-black shadow-lg">
                  {index + 1}
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-4 pt-2">
                  {t('step')} {index + 1}
                </p>
                <p className="text-base font-medium leading-relaxed text-primary">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
