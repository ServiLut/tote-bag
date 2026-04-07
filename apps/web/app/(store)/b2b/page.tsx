'use client';

import B2BQuoteForm from '@/components/b2b/B2BQuoteForm';
import ImageCarousel from '@/components/b2b/ImageCarousel';
import { Building2, QrCode, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SHOW_QR_MARKETING_BLOCK = false;

export default function B2BPage() {
  const { t } = useTranslation();

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-stretch mb-16">
          <div className="space-y-10 animate-in slide-in-from-left duration-500 flex flex-col h-full">
            <div>
              <span className="inline-block px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
                {t('b2b_badge')}
              </span>
              <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight mb-6">
                {t('b2b_title_line_1')} <br /> {t('b2b_title_line_2')}
              </h1>
              <p className="text-lg text-muted leading-relaxed">{t('b2b_description')}</p>
            </div>

            <div className="grid gap-8">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">{t('b2b_premium_title')}</h3>
                  <p className="text-sm text-muted">{t('b2b_premium_description')}</p>
                </div>
              </div>

              {SHOW_QR_MARKETING_BLOCK ? (
                <div className="flex gap-4 items-start">
                  <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                    <QrCode className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-primary mb-1">{t('b2b_qr_title')}</h3>
                    <p className="text-sm text-muted">{t('b2b_qr_description')}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Building2 className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">{t('b2b_logistics_title')}</h3>
                  <p className="text-sm text-muted">{t('b2b_logistics_description')}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 w-full rounded-2xl overflow-hidden shadow-lg border border-theme bg-surface p-1 flex-1 flex flex-col">
              <div className="relative w-full flex-1 bg-base rounded-xl overflow-hidden min-h-[300px]">
                <ImageCarousel />
              </div>
            </div>
          </div>

          <div className="relative animate-in slide-in-from-right duration-500 delay-100">
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-pulse pointer-events-none"></div>
            <B2BQuoteForm />
          </div>
        </div>
      </main>
    </>
  );
}
