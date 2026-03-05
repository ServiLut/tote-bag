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
      description: "Una sola Tote Bag puede reemplazar hasta 500 bolsas de plástico de un solo uso al año."
    },
    {
      icon: <Heart className="w-10 h-10 text-secondary" />,
      title: t('durable'),
      description: "Fabricadas con materiales de alta calidad, nuestras bolsas están diseñadas para resistir el uso diario por años."
    },
    {
      icon: <Settings className="w-10 h-10 text-secondary" />,
      title: t('customizable'),
      description: "Refleja tu estilo o marca con diseños únicos que duran tanto como la bolsa misma."
    },
    {
      icon: <Globe className="w-10 h-10 text-secondary" />,
      title: t('carbon_footprint'),
      description: "Disminuye significativamente tu impacto ambiental al reducir la demanda de polímeros derivados del petróleo."
    }
  ];

  return (
    <div className="bg-base min-h-screen">
      {/* Encabezado Hero */}
      <section className="py-20 px-4 text-center bg-secondary/10">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="text-secondary font-bold tracking-widest uppercase text-xs flex items-center justify-center gap-2">
            <Leaf className="w-4 h-4" /> {t('eco_conscience')}
          </span>
          <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight">
            {t('eco_revolution_title')}
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Pequeños cambios generan grandes impactos. Descubre por qué elegir una Tote Bag es el primer paso hacia un futuro más verde y responsable.
          </p>
        </div>
      </section>

      {/* Sección de Ventajas (Grid) */}
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

      {/* Sección Comparativa */}
      <section className="py-24 bg-surface px-4 border-y border-theme">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif text-primary uppercase tracking-tight">{t('comparative_impact')}</h2>
            <p className="text-muted mt-4">La realidad en números y hechos ambientales.</p>
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
                  <td className="py-6 px-6 text-secondary font-medium">4 - 6 años de uso intenso</td>
                  <td className="py-6 px-6 text-muted">12 - 15 minutos (un solo uso)</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted" /> {t('environmental_impact')}
                  </td>
                  <td className="py-6 px-6">Bajo (Materiales biodegradables o reciclados)</td>
                  <td className="py-6 px-6">Alto (Contaminación de océanos y suelos)</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted" /> {t('long_term_cost')}
                  </td>
                  <td className="py-6 px-6">Ahorro significativo al evitar compras recurrentes</td>
                  <td className="py-6 px-6">Costo oculto en gestión de residuos y compra constante</td>
                </tr>
                <tr>
                  <td className="py-6 px-6 font-medium flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-muted" /> {t('degradation')}
                  </td>
                  <td className="py-6 px-6 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-secondary" /> 1 - 5 años (Fibras naturales)
                  </td>
                  <td className="py-6 px-6 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-accent" /> 100 - 500 años (Microplásticos)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Llamado a la Acción (CTA) */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-3xl mx-auto space-y-10">
          <h2 className="text-3xl md:text-4xl font-serif text-primary">{t('ready_for_change')}</h2>
          <p className="text-muted text-lg">
            Explora nuestra colección y encuentra la compañera perfecta para tu día a día sostenible.
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
