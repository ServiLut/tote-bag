'use client';

import Link from 'next/link';
import { COMPANY_INFO } from '@/utils/company-info';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="force-light mt-auto border-t border-theme bg-primary px-4 py-16 text-base-color transition-colors duration-300">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-4">
        <div className="col-span-1 space-y-6 md:col-span-2">
          <h3 className="text-2xl font-serif font-bold tracking-tighter">{COMPANY_INFO.name}</h3>
          <p className="max-w-xs text-sm leading-relaxed opacity-90">
            {t('footer_brand_description')}
          </p>
        </div>
        <div>
          <h4 className="mb-6 text-xs font-bold uppercase tracking-[0.2em]">{t('footer_navigation')}</h4>
          <ul className="space-y-4 text-sm opacity-90">
            <li><Link href="/catalog" className="font-medium transition-opacity hover:opacity-100">{t('nav_shop')}</Link></li>
            <li><Link href="/about" className="font-medium transition-opacity hover:opacity-100">{t('footer_about')}</Link></li>
            <li><Link href="/beneficios" className="font-medium transition-opacity hover:opacity-100">{t('footer_sustainability')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-6 text-xs font-bold uppercase tracking-[0.2em]">{t('footer_support')}</h4>
          <ul className="space-y-4 text-sm opacity-90">
            <li><Link href="/legal/privacy" className="font-medium transition-opacity hover:opacity-100">{t('footer_privacy')}</Link></li>
            <li><Link href="/legal/data-processing" className="font-medium transition-opacity hover:opacity-100">{t('footer_data_processing')}</Link></li>
            <li><Link href="/envios" className="font-medium transition-opacity hover:opacity-100">{t('footer_shipping')}</Link></li>
            <li><Link href="/pqrs" className="font-medium transition-opacity hover:opacity-100">{t('footer_pqrs')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-20 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-theme/20 pt-8 text-[10px] uppercase tracking-widest opacity-70 md:flex-row">
        <span>&copy; {new Date().getFullYear()} {COMPANY_INFO.name}. {t('footer_rights')}</span>
        <span>{t('footer_made_in_colombia')}</span>
      </div>
    </footer>
  );
}
