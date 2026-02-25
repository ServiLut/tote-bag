import { Metadata } from 'next';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';

export const metadata: Metadata = {
  title: 'Configurador | Personaliza tu Tote Bag',
  description: 'Elige cada detalle de tu producción técnica.',
};

export default function ConfiguradorPage() {
  // We use a fixed ID or fetch one. For this implementation, 
  // we'll assume the primary customizable product has a known ID or handle it via slug in the wizard.
  const BASE_PRODUCT_ID = "32811cb6-7ca0-41eb-a0ce-20d35c526ec1";

  return (
    <div className="bg-base min-h-screen py-12 md:py-20 px-4">
      <PersonalizerWizard productId={BASE_PRODUCT_ID} />
    </div>
  );
}
