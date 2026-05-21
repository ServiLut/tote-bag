'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight, CheckCircle2, Palette, Ruler } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { buildStorefrontWhatsAppUrl } from '@/lib/whatsapp';

interface PersonalizePageContentProps {
  productId?: string;
  productSlug: string;
}

export default function PersonalizePageContent({
  productId,
  productSlug,
}: PersonalizePageContentProps) {
  const { t } = useTranslation();
  const introHighlights = [
    {
      icon: Palette,
      title: t('personalize_intro_highlight_design_title', {
        defaultValue: 'Sube tu idea o logo',
      }),
      description: t('personalize_intro_highlight_design_description', {
        defaultValue: 'Prepara el arte antes de enviar la solicitud formal.',
      }),
    },
    {
      icon: Ruler,
      title: t('personalize_intro_highlight_base_title', {
        defaultValue: 'Define base y cantidad',
      }),
      description: t('personalize_intro_highlight_base_description', {
        defaultValue: 'Línea, material, tamaño y unidades alimentan la cotización.',
      }),
    },
    {
      icon: CheckCircle2,
      title: t('personalize_intro_highlight_review_title', {
        defaultValue: 'Recibe revisión comercial',
      }),
      description: t('personalize_intro_highlight_review_description', {
        defaultValue: 'Un asesor valida técnica, tiempos y precio final.',
      }),
    },
  ];
  const processSteps = [
    {
      step: '01',
      title: t('wizard_base_configuration', {
        defaultValue: 'Configuración base',
      }),
      description: t('personalize_intro_step_base_description', {
        defaultValue: 'Organiza la referencia antes de cargar el arte.',
      }),
    },
    {
      step: '02',
      title: t('wizard_upload_design', {
        defaultValue: 'Sube tu diseño',
      }),
      description: t('personalize_intro_step_design_description', {
        defaultValue: 'Carga logo, frase o imagen para la previsualización.',
      }),
    },
    {
      step: '03',
      title: t('wizard_submit_review', {
        defaultValue: 'Enviar para revisión',
      }),
      description: t('personalize_intro_step_submit_description', {
        defaultValue: 'Te pediremos ingreso solo al formalizar la solicitud.',
      }),
    },
  ];
  const heroBadge = t('personalize_intro_badge', {
    defaultValue: 'Empieza sin iniciar sesión',
  });
  const heroTitle = t('personalize_title', {
    defaultValue: 'Personalización',
  });
  const heroDescription = t('personalize_description', {
    defaultValue:
      'Configura tu tote bag, carga tu diseño y prepara la solicitud antes de pasar al registro o la revisión final.',
  });
  const loginNote = t('personalize_intro_login_note', {
    defaultValue:
      'Puedes avanzar en la configuración y solo te pediremos ingreso al momento de enviar la solicitud formal.',
  });
  const whatsappCta = t('personalize_intro_cta_whatsapp', {
    defaultValue: 'Resolver idea por WhatsApp',
  });
  const catalogCta = t('personalize_intro_cta_catalog', {
    defaultValue: 'Ver catálogo primero',
  });
  const processTitle = t('personalize_intro_process_title', {
    defaultValue: 'Cómo funciona este flujo',
  });
  const processDescription = t('personalize_intro_process_description', {
    defaultValue:
      'Está pensado para que armes la base del pedido, valides un estimado y luego formalices la solicitud cuando ya tengas clara la idea.',
  });
  const estimateTitle = t('wizard_estimated_prices', {
    defaultValue: 'Precios estimados',
  });
  const estimateDescription = t('wizard_estimated_price_note', {
    defaultValue:
      'Precio estimado. El precio final lo define el asesor al revisar la solicitud.',
  });

  return (
    <div className="bg-base min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-12">
        <section className="relative overflow-hidden rounded-[2.5rem] border border-theme bg-surface shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-secondary/10 via-transparent to-primary/10" />
          <div className="relative grid gap-8 p-6 md:p-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] xl:gap-10 xl:p-10">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-primary">
                {heroBadge}
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-serif font-bold tracking-tight text-primary md:text-5xl xl:text-6xl">
                  {heroTitle}
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted md:text-base">
                  {heroDescription}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {introHighlights.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="rounded-[1.5rem] border border-theme bg-white/80 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                      <Icon size={18} />
                    </div>
                    <p className="mt-4 text-sm font-bold text-primary">{title}</p>
                    <p className="mt-2 text-xs leading-6 text-muted">{description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.75rem] border border-primary/10 bg-primary/[0.04] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  {t('personalize_intro_access_title', {
                    defaultValue: 'Acceso sin bloqueo',
                  })}
                </p>
                <p className="mt-2 text-sm leading-6 text-primary">{loginNote}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href={buildStorefrontWhatsAppUrl('personalize')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-500 bg-green-50 px-5 py-3 text-center text-sm font-bold text-green-700 transition-colors hover:bg-green-100"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  {whatsappCta}
                </Link>
                <Link
                  href="/catalog"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-theme px-5 py-3 text-center text-sm font-bold text-primary transition-colors hover:bg-base"
                >
                  {catalogCta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <aside className="space-y-5 rounded-[2rem] border border-theme bg-base/50 p-5 md:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  {processTitle}
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {processDescription}
                </p>
              </div>

              <div className="space-y-3">
                {processSteps.map(({ step, title, description }) => (
                  <div
                    key={step}
                    className="rounded-[1.5rem] border border-theme bg-white/85 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-[11px] font-black tracking-[0.16em] text-white">
                        {step}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-primary">{title}</p>
                        <p className="mt-1 text-xs leading-6 text-muted">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.75rem] border border-primary/10 bg-white/90 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">
                  {estimateTitle}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-theme bg-base/40 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                      {t('wizard_estimated_price_small_label', {
                        defaultValue: '30 cm x 35 cm',
                      })}
                    </p>
                    <p className="mt-1 text-sm font-bold text-primary">
                      {t('wizard_estimated_price_small_value', {
                        defaultValue: 'desde $63.750 COP',
                      })}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-theme bg-base/40 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
                      {t('wizard_estimated_price_large_label', {
                        defaultValue: '45 cm x 38 cm',
                      })}
                    </p>
                    <p className="mt-1 text-sm font-bold text-primary">
                      {t('wizard_estimated_price_large_value', {
                        defaultValue: 'desde $69.000 COP',
                      })}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-6 text-muted">
                  {estimateDescription}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20">
        <div className="w-full">
          <PersonalizerWizard
            productId={productId}
            productSlug={productSlug}
            mode="direct"
          />
        </div>
      </div>
    </div>
  );
}
