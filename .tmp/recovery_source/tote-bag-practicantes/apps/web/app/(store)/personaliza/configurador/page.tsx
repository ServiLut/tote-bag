import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: 'Configurador | Personaliza tu Tote Bag',
  description: 'Elige cada detalle de tu producción técnica.',
};

export default async function ConfiguradorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/personaliza/configurador');
  }

  return (
    <div className="bg-base min-h-screen py-12 md:py-20 px-4">
      <PersonalizerWizard productSlug="tote-bag-clasica" />
    </div>
  );
}

