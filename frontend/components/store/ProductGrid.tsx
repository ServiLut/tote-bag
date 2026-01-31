import { Product } from '@/types/product';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-muted border border-dashed border-theme rounded-lg">
        <p>No encontramos productos con estos filtros.</p>
        <button 
          onClick={() => window.location.href = '/catalog'}
          className="mt-2 text-sm text-primary underline underline-offset-4 font-medium hover:text-accent transition-colors"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
