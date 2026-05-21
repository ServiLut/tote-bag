import type { Metadata } from 'next';
import AboutPage from '@/components/store/AboutPage';

export const metadata: Metadata = {
  title: 'Nosotros | Tote bags funcionales y personalizables',
  description:
    'Conoce la historia, enfoque de produccion y compromiso comercial de Tote Bag Bolsa de Tela en Colombia.',
};

export default function StoreAboutPage() {
  return <AboutPage />;
}
