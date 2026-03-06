import { Metadata } from 'next';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';

export const metadata: Metadata = {
  title: 'Configurador | Personaliza tu Tote Bag',
  description: 'Elige cada detalle de tu producción técnica.',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4003/api/v1';

async function getBaseProduct() {
  const slug = 'tote-bag-clasica';
  try {
    const res = await fetch(`${API_URL}/catalog/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data;
  } catch (error) {
    console.error('Error fetching base product:', error);
    return null;
  }
}

export default async function ConfiguradorPage() {
  const product = await getBaseProduct();

  if (!product) {
    return (
      <div className="bg-base min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">Configurador no disponible</h1>
          <p className="text-muted">No se pudo encontrar el producto base.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-base min-h-screen py-12 md:py-20 px-4">
      <PersonalizerWizard productId={product.id} />
    </div>
  );
}
