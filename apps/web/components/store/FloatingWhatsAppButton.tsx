'use client';

import { usePathname } from 'next/navigation';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';
import {
  buildStorefrontWhatsAppUrl,
  getProductNameFromPathname,
  getWhatsAppContextFromPathname,
} from '@/lib/whatsapp';

export default function FloatingWhatsAppButton() {
  const pathname = usePathname();
  const context = getWhatsAppContextFromPathname(pathname);
  const href = buildStorefrontWhatsAppUrl(
    context,
    context === 'product' ? getProductNameFromPathname(pathname) : undefined,
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir conversacion por WhatsApp"
      className="fixed bottom-6 right-6 z-40 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl shadow-green-500/30 transition-all hover:scale-105 hover:bg-green-600 active:scale-95"
      title="Escribenos por WhatsApp"
    >
      <WhatsAppIcon className="h-8 w-8 text-white" />
    </a>
  );
}
