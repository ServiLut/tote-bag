'use client';

import { useTranslation } from 'react-i18next';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';

interface PersonalizePageContentProps {
  productId?: string;
  productSlug: string;
}

export default function PersonalizePageContent({
  productId,
  productSlug,
}: PersonalizePageContentProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-base min-h-screen">
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-12">
        <h1 className="mb-2 text-3xl font-serif font-bold text-primary md:text-5xl">
          {t('personalize_title')}
        </h1>
        <p className="text-sm text-muted md:text-base">
          {t('personalize_description')}
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-0 pb-20 md:px-4">
        <PersonalizerWizard
          productId={productId}
          productSlug={productSlug}
          mode="direct"
        />
      </div>
    </div>
  );
}
