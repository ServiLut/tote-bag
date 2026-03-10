import { Metadata } from 'next';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Personaliza tu Tote Bag | Configurador Técnico',
  description: 'Diseña tu producción a medida: elige línea, materiales, dimensiones y personaliza con tu logo.',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

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

export default async function PersonalizaPage() {
  const product = await getBaseProduct();

  if (!product) {
    // If not found, try using the hardcoded one as fallback or show error
    // For now, if it's missing, the wizard won't work anyway
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
    <div className="bg-base min-h-screen">
      {/* Header Contextual */}
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-2">Configurador Técnico</h1>
        <p className="text-muted text-sm md:text-base">Define las especificaciones de tu producción y obtén una cotización inmediata.</p>
      </div>

      <div className="max-w-7xl mx-auto px-0 md:px-4 pb-20">
        <PersonalizerWizard productId={product.id} />
      </div>
    </div>
  );
}
