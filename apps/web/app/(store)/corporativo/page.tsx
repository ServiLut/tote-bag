import type { Metadata } from 'next';
import CorporatePage from '@/components/store/CorporatePage';

export const metadata: Metadata = {
  title: 'Pedidos corporativos de tote bags | Produccion por volumen',
  description:
    'Explora el proceso corporativo, tiempos de produccion y formulario de cotizacion para tote bags empresariales en Colombia.',
};

export default function StoreCorporatePage() {
  return <CorporatePage />;
}
