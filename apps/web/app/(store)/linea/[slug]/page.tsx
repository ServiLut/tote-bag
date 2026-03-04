import { Metadata } from 'next';
import ProductGrid from '@/components/store/ProductGrid';
import { Product } from '@/types/product';
import { ApiResponse } from '@/types/api';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4003/api/v1';

async function getProductsByLine(line: string): Promise<Product[]> {
  try {
    const res = await fetch(`${API_URL}/catalog/products?lines=${line.toUpperCase()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    const response: ApiResponse<Product[]> = await res.json();
    return response.data;
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lineName = slug.charAt(0).toUpperCase() + slug.slice(1);
  
  return {
    title: `Línea ${lineName} | Tote Bag Shop`,
    description: `Descubre nuestra colección de tote bags de la línea ${lineName}. Calidad y sostenibilidad en cada diseño.`,
  };
}

export default async function LineaPage({ params }: PageProps) {
  const { slug } = await params;
  const products = await getProductsByLine(slug);

  const lineName = slug.charAt(0).toUpperCase() + slug.slice(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <header className="mb-12 border-b border-theme pb-8 text-center sm:text-left">
        <h1 className="text-4xl font-serif font-bold text-primary mb-4 uppercase tracking-tight">Línea {lineName}</h1>
        <p className="text-muted max-w-2xl text-lg font-light leading-relaxed">
          Explora los diseños exclusivos de nuestra línea {lineName}. Seleccionamos los mejores materiales para brindarte estilo y durabilidad con un impacto positivo.
        </p>
      </header>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : (
        <div className="py-24 text-center bg-surface rounded-3xl border border-theme shadow-sm">
          <p className="text-muted text-lg font-medium italic">No se encontraron productos en esta línea por el momento.</p>
        </div>
      )}
    </div>
  );
}
