import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: 'Configurador | Personaliza tu Tote Bag',
  description: 'Elige cada detalle de tu produccion tecnica.',
};

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
  const configuratorParams = new URLSearchParams();
  if (requestedProductId) {
    configuratorParams.set('productId', requestedProductId);
  } else {
    configuratorParams.set('product', requestedProduct);
  }
  const configuratorPath = `/personaliza/configurador?${configuratorParams.toString()}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(configuratorPath)}`);
  }

  return (
    <div className="bg-base min-h-screen py-12 md:py-20 px-4">
      <PersonalizerWizard
        productId={requestedProductId}
        productSlug={requestedProduct}
      />
    </div>
  );
}
