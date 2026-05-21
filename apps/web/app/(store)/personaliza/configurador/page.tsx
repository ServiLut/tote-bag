import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY } from '@/lib/i18n-config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = (cookieStore.get(LANGUAGE_COOKIE_KEY)?.value || DEFAULT_LANGUAGE).startsWith('en')
    ? 'en'
    : 'es';

  return language === 'en'
    ? {
        title: 'Tote Bag Configurator | Customization',
        description:
          'Choose line, size, material, and marking technique to prepare your customization request.',
      }
    : {
        title: 'Configurador de tote bag | Personalizacion',
        description:
          'Elige linea, tamano, material y tecnica para preparar tu solicitud de personalizacion.',
      };
}

interface PageProps {
  searchParams: Promise<{
    product?: string;
    productId?: string;
  }>;
}

export default async function ConfiguradorPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestedProductId =
    typeof params.productId === 'string' && params.productId.trim().length > 0
      ? params.productId.trim()
      : undefined;
  const requestedProduct =
    typeof params.product === 'string' && params.product.trim().length > 0
      ? params.product.trim()
      : 'tote-bag-clasica';

  return (
    <div className="bg-base min-h-screen py-12 md:py-20 px-4">
      <PersonalizerWizard
        productId={requestedProductId}
        productSlug={requestedProduct}
      />
    </div>
  );
}
