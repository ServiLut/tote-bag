'use client';

import Link from 'next/link';
import { Leaf, ShoppingBag, Star, Briefcase, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LineasPage() {
  const { t } = useTranslation();
  const lines = [
    {
      key: 'eco',
      name: t('lines_eco_name'),
      icon: Leaf,
      description: t('lines_eco_description'),
      features: [t('lines_eco_feature_1'), t('lines_eco_feature_2'), t('lines_eco_feature_3')],
      color: 'text-green-600',
      bg: 'bg-green-50'
    },
    {
      key: 'commercial',
      name: t('lines_commercial_name'),
      icon: ShoppingBag,
      description: t('lines_commercial_description'),
      features: [t('lines_commercial_feature_1'), t('lines_commercial_feature_2'), t('lines_commercial_feature_3')],
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      key: 'premium',
      name: t('lines_premium_name'),
      icon: Star,
      description: t('lines_premium_description'),
      features: [t('lines_premium_feature_1'), t('lines_premium_feature_2'), t('lines_premium_feature_3')],
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      key: 'corporate',
      name: t('lines_corporate_name'),
      icon: Briefcase,
      description: t('lines_corporate_description'),
      features: [t('lines_corporate_feature_1'), t('lines_corporate_feature_2'), t('lines_corporate_feature_3')],
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    }
  ];

  return (
    <div className="bg-base min-h-screen py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-primary mb-4">{t('lines_title')}</h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">{t('lines_description')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {lines.map((line) => (
            <div key={line.key} className="flex flex-col bg-white border border-theme rounded-lg p-8 transition-all hover:shadow-xl hover:-translate-y-1">
              <div className={`w-12 h-12 ${line.bg} ${line.color} rounded-full flex items-center justify-center mb-6`}>
                <line.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-primary mb-4">{line.name}</h3>
              <p className="text-muted text-sm mb-6 flex-grow">{line.description}</p>
              <ul className="space-y-3 mb-8">
                {line.features.map((feature) => (
                  <li key={feature} className="flex items-center text-xs font-medium text-muted">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-2"></div>
                    {feature}
                  </li>
                ))}
              </ul>
              {line.key === 'corporate' ? (
                <Link href="/corporativo" className="w-full py-3 bg-primary text-base-color text-center rounded text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all">
                  {t('lines_consult_b2b')}
                </Link>
              ) : (
                <Link href="/catalog" className="w-full py-3 border border-primary text-primary text-center rounded text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-base-color transition-colors flex items-center justify-center gap-2">
                  {t('lines_view_products')} <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
