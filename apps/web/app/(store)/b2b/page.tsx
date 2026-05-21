import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import B2BPage from '@/components/store/B2BPage';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY } from '@/lib/i18n-config';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = (cookieStore.get(LANGUAGE_COOKIE_KEY)?.value || DEFAULT_LANGUAGE).startsWith('en')
    ? 'en'
    : 'es';

  return language === 'en'
    ? {
        title: 'B2B Tote Bag Quotes | Companies and events',
        description:
          'Request tote bag quotes for companies, events, activations, and corporate gifts in Colombia.',
      }
    : {
        title: 'Cotizacion B2B de tote bags | Empresas y eventos',
        description:
          'Solicita cotizaciones de tote bags para empresas, eventos, activaciones y regalos corporativos en Colombia.',
      };
}

export default function StoreB2BPage() {
  return <B2BPage />;
}
