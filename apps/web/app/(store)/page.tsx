import type { Metadata } from 'next';
import HomePage from '@/components/store/HomePage';

export const metadata: Metadata = {
  title: 'Tote bags listas para comprar o personalizar',
  description:
    'Disenos en stock, produccion bajo pedido y soluciones corporativas para marcas, eventos y regalos empresariales en Colombia.',
};

export default function StorefrontHomePage() {
  return <HomePage />;
}
