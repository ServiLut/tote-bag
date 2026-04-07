'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Leaf, Recycle, Heart, Settings, Trash2, Clock, Globe, DollarSign, CheckCircle2, XCircle } from 'lucide-react';

export default function BeneficiosPage() {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: <Recycle className="w-10 h-10 text-secondary" />,
      title: t('reusable'),
      description: t('benefits_reusable_description')
    },
    {
      icon: <Heart className="w-10 h-10 text-secondary" />,
      title: t('durable'),
      description: t('benefits_durable_description')
    },
    {
      icon: <Settings className="w-10 h-10 text-secondary" />,
      title: t('customizable'),
      description: t('benefits_customizable_description')
    },
    {
      icon: <Globe className="w-10 h-10 text-secondary" />,
      title: t('carbon_footprint'),
      description: t('benefits_carbon_footprint_description')
    }
  ];

  return (
    <div className="bg-base min-h-screen">
      <section className="py-20 px-4 text-center bg-secondary/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="text-secondary font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2">
            <Leaf className="w-4 h-4" /> {t('eco_conscience')}
          </span>
          <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight">
            {t('eco_revolution_title')}
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            {t('benefits_hero_description')}
          </p>
        </div>
      </section>

      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-serif text-primary uppercase tracking-tight">{t('benefits_title')}</h2>
          <div className="h-1 w-20 bg-accent mx-auto mt-4"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {benefits.map((benefit, index) => (
            <div key={index} className="bg-surface p-8 rounded-sm shadow-sm border border-theme hover:border-secondary transition-colors group">
              <div className="mb-6 group-hover:scale-110 transition-transform duration-300">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3">{benefit.title}</h3>
              <p className="text-muted text-sm leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-24 bg-surface px-4 border-y border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-primary uppercase tracking-tight">{t('comparative_impact')}</h2>
            <p className="text-muted mt-4">{t('benefits_comparison_description')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-primary">
                  <th className="py-4 px-6 text-sm font-bold uppercase tracking-widest text-primary">{t('attribute')}</th>
                  <th className="py-4 px-6 text-sm font-bold uppercase tracking-widest text-secondary bg-secondary/5">{t('tote_bags')}</th>
                  <th className="py-4 px-6 text-sm font-bold uppercase tracking-widest text-accent">{t('plastic_bags')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted" /> {t('lifespan')}
                  </td>
                  <td className="py-6 px-6 text-secondary font-medium">{t('benefits_lifespan_tote')}</td>
                  <td className="py-6 px-6 text-muted">{t('benefits_lifespan_plastic')}</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted" /> {t('environmental_impact')}
                  </td>
                  <td className="py-6 px-6">{t('benefits_environmental_impact_tote')}</td>
                  <td className="py-6 px-6">{t('benefits_environmental_impact_plastic')}</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted" /> {t('long_term_cost')}
                  </td>
                  <td className="py-6 px-6">{t('benefits_long_term_cost_tote')}</td>
                  <td className="py-6 px-6">{t('benefits_long_term_cost_plastic')}</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-muted" /> {t('degradation')}
                  </td>
                  <td className="py-6 px-6 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-secondary" /> {t('benefits_degradation_tote')}
                  </td>
                  <td className="py-6 px-6 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-accent" /> {t('benefits_degradation_plastic')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-3xl md:text-4xl font-serif text-primary">{t('ready_for_change')}</h2>
          <p className="text-muted text-lg">
            {t('benefits_cta_description')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/catalog" className="px-10 py-4 btn-primary font-bold rounded-sm uppercase tracking-widest text-sm">
              {t('explore_catalog')}
            </Link>
            <Link href="/corporativo" className="px-10 py-4 btn-outline font-bold rounded-sm uppercase tracking-widest text-sm border-secondary text-secondary hover:bg-secondary hover:text-white">
              {t('customize_tote')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
