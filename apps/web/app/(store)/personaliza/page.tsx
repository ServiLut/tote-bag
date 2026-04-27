import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import PersonalizerWizard from '@/components/store/PersonalizerWizard';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: 'Personaliza tu Tote Bag | Personalizacion',
  description:
    'Sube tu diseno, elige la configuracion base y envia tu solicitud de personalizacion.',
};

export default async function PersonalizaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/personaliza');
  }

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-7xl mx-auto px-4 pt-12 pb-8">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-2">
          Personalizacion
        </h1>
        <p className="text-muted text-sm md:text-base">
          Sube tu diseno, elige la configuracion base y envia tu solicitud para
          revision.
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-0 md:px-4 pb-20">
        <PersonalizerWizard productSlug="tote-bag-clasica" mode="direct" />
      </div>
    </div>
  );
}
