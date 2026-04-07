'use client';

import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import { COMPANY_INFO } from '@/utils/company-info';

function getWhatsAppUrl() {
  const cleanPhone = COMPANY_INFO.phone.replace(/\D/g, '');
  const message = encodeURIComponent(
    'Hola, me gustaría recibir información sobre los productos de Tote Bag Shop.',
  );

  return `https://wa.me/${cleanPhone}?text=${message}`;
}

export default function FloatingWhatsAppButton() {
  return (
    <a
      href={getWhatsAppUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir conversación por WhatsApp"
      className="fixed bottom-6 right-6 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-600 active:scale-95"
      title="Escríbenos por WhatsApp"
    >
      <WhatsAppIcon className="h-8 w-8 text-white" />
    </a>
  );
}
