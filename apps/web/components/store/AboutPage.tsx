'use client';

import Image from 'next/image';
import { Leaf, Handshake, Infinity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { COMPANY_INFO } from '@/utils/company-info';

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <>
      <section className="h-[60vh] w-full flex items-center justify-center bg-secondary/10 px-4">
        <div className="text-center px-4 max-w-4xl mx-auto space-y-6">
          <span className="uppercase tracking-[0.2em] text-sm font-medium text-secondary mb-4 block">{t('about_history')}</span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold text-primary mb-6">
            {t('about_hero_title')}
          </h1>
          <p className="text-xl md:text-2xl font-light text-muted max-w-2xl mx-auto">
            {t('about_hero_description')}
          </p>
        </div>
      </section>

      <section className="py-24 px-4 container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl font-serif font-bold text-primary">{t('about_mission_title')}</h2>
            <div className="w-20 h-1 bg-secondary" />
            <p className="text-lg text-muted leading-relaxed">
              {t('about_mission_paragraph_1', { company: COMPANY_INFO.name })}
            </p>
            <p className="text-lg text-muted leading-relaxed">
              {t('about_mission_paragraph_2')}
            </p>
          </div>
          <div className="relative h-[500px] w-full bg-surface rounded-lg overflow-hidden shadow-xl">
            <Image
              src="/tote_bag_lifestyle.png"
              alt={t('about_image_alt')}
              fill
              className="object-cover opacity-90"
              priority
            />
            <div className="absolute inset-0 bg-secondary/10 flex items-center justify-center" />
          </div>
        </div>
      </section>

      <section className="bg-surface py-24 px-4 border-y border-theme">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-serif font-bold text-primary mb-16">{t('about_values_title')}</h2>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-secondary/20 rounded-full mx-auto flex items-center justify-center mb-6">
                <Leaf className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-primary">{t('about_materials_title')}</h3>
              <p className="text-muted">{t('about_materials_description')}</p>
            </div>

            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-accent/20 rounded-full mx-auto flex items-center justify-center mb-6">
                <Handshake className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-primary">{t('about_fair_trade_title')}</h3>
              <p className="text-muted">{t('about_fair_trade_description')}</p>
            </div>

            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center mb-6">
                <Infinity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">{t('about_durability_title')}</h3>
              <p className="text-muted">{t('about_durability_description')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 container mx-auto max-w-4xl text-center">
        <h2 className="text-4xl font-serif font-bold text-primary mb-6">{t('about_join_title')}</h2>
        <p className="text-lg text-muted mb-10 max-w-2xl mx-auto">
          {t('about_join_description')}
        </p>
        <div className="bg-primary text-base-color p-8 rounded-lg inline-block text-left shadow-lg">
          <p className="mb-2"><strong>Email:</strong> {COMPANY_INFO.email.support}</p>
          <p className="mb-2"><strong>{t('about_phone')}</strong> {COMPANY_INFO.phone}</p>
          <p><strong>{t('about_location')}</strong> {COMPANY_INFO.address}</p>
        </div>
      </section>
    </>
  );
}
