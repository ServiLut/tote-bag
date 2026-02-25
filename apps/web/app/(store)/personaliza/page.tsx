import { Metadata } from 'next';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';

export const metadata: Metadata = {
  title: 'Personaliza tu Tote Bag | Configurador Técnico',
  description: 'Diseña tu producción a medida: elige línea, materiales, dimensiones y personaliza con tu logo.',
};

export default function PersonalizaPage() {
  // Base product for technical configuration
  const BASE_PRODUCT_ID = "32811cb6-7ca0-41eb-a0ce-20d35c526ec1";

  return (
    <div className="bg-base min-h-screen">
      {/* Header Contextual */}
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-2">Configurador Técnico</h1>
        <p className="text-muted text-sm md:text-base">Define las especificaciones de tu producción y obtén una cotización inmediata.</p>
      </div>

      <div className="max-w-7xl mx-auto px-0 md:px-4 pb-20">
        <PersonalizerWizard productId={BASE_PRODUCT_ID} />
      </div>
    </div>
  );
}
