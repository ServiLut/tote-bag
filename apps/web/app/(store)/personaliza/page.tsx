import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import PersonalizePageContent from '@/components/store/PersonalizePageContent';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY } from '@/lib/i18n-config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = (cookieStore.get(LANGUAGE_COOKIE_KEY)?.value || DEFAULT_LANGUAGE).startsWith('en')
    ? 'en'
    : 'es';

  return language === 'en'
    ? {
        title: 'Customize your Tote Bag | Configuration and review',
        description:
          'Configure your tote bag, estimate your request, and share your idea before sending the final customization request.',
      }
    : {
        title: 'Personaliza tu tote bag | Configura y solicita asesoria',
        description:
          'Configura tu tote bag, estima tu solicitud y comparte tu idea antes de enviar la cotizacion o pedido formal.',
      };
}

interface PageProps {
  searchParams: Promise<{
    product?: string;
    productId?: string;
  }>;
}

export default async function PersonalizaPage({ searchParams }: PageProps) {
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
    <PersonalizePageContent
      productId={requestedProductId}
      productSlug={requestedProduct}
    />
  );
}
