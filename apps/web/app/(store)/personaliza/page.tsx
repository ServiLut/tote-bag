import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PersonalizePageContent from '@/components/store/PersonalizePageContent';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY } from '@/lib/i18n-config';
import { createClient } from '@/utils/supabase/server';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = (cookieStore.get(LANGUAGE_COOKIE_KEY)?.value || DEFAULT_LANGUAGE).startsWith('en')
    ? 'en'
    : 'es';

  return language === 'en'
    ? {
        title: 'Customize your Tote Bag | Customization',
        description:
          'Upload your design, choose the base configuration, and send your customization request for review.',
      }
    : {
        title: 'Personaliza tu Tote Bag | Personalización',
        description:
          'Sube tu diseño, elige la configuración base y envía tu solicitud de personalización para revisión.',
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
  const personalizationParams = new URLSearchParams();
  if (requestedProductId) {
    personalizationParams.set('productId', requestedProductId);
  } else {
    personalizationParams.set('product', requestedProduct);
  }
  const personalizationPath = `/personaliza?${personalizationParams.toString()}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(personalizationPath)}`);
  }

  return (
    <PersonalizePageContent
      productId={requestedProductId}
      productSlug={requestedProduct}
    />
  );
}
