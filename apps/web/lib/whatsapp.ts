import { COMPANY_INFO } from '@/utils/company-info';

type StorefrontWhatsAppContext =
  | 'home'
  | 'catalog'
  | 'product'
  | 'personalize'
  | 'b2b'
  | 'corporate'
  | 'shipping'
  | 'generic';

function getCleanWhatsAppPhone() {
  return COMPANY_INFO.phone.replace(/\D/g, '');
}

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${getCleanWhatsAppPhone()}?text=${encodeURIComponent(message)}`;
}

export function buildStorefrontWhatsAppUrl(
  context: StorefrontWhatsAppContext,
  detail?: string,
) {
  const messages: Record<StorefrontWhatsAppContext, string> = {
    home:
      'Hola, quiero asesoria para elegir una tote bag en stock, personalizada o corporativa.',
    catalog:
      'Hola, estoy revisando el catalogo y quiero ayuda para elegir una tote bag.',
    product: detail
      ? `Hola, quiero informacion sobre ${detail}.`
      : 'Hola, quiero informacion sobre una tote bag del catalogo.',
    personalize: detail
      ? `Hola, quiero personalizar ${detail} y necesito asesoria para mi idea.`
      : 'Hola, quiero personalizar una tote bag y necesito asesoria para mi idea.',
    b2b:
      'Hola, quiero cotizar tote bags para empresa, evento o activacion de marca.',
    corporate:
      'Hola, me interesa informacion sobre pedidos corporativos y produccion por volumen.',
    shipping:
      'Hola, quiero recibir asesoria sobre envios y devoluciones de mi compra.',
    generic:
      'Hola, quiero recibir informacion sobre los productos de Tote Bag Bolsa de Tela.',
  };

  return buildWhatsAppUrl(messages[context]);
}

export function getWhatsAppContextFromPathname(pathname: string) {
  if (pathname === '/') {
    return 'home' as const;
  }

  if (pathname === '/catalog') {
    return 'catalog' as const;
  }

  if (pathname.startsWith('/catalog/')) {
    return 'product' as const;
  }

  if (pathname.startsWith('/personaliza')) {
    return 'personalize' as const;
  }

  if (pathname === '/b2b') {
    return 'b2b' as const;
  }

  if (pathname === '/corporativo') {
    return 'corporate' as const;
  }

  if (pathname === '/envios') {
    return 'shipping' as const;
  }

  return 'generic' as const;
}

export function getProductNameFromPathname(pathname: string) {
  if (!pathname.startsWith('/catalog/')) {
    return undefined;
  }

  const slug = pathname.split('/').filter(Boolean)[1];
  if (!slug) {
    return undefined;
  }

  return slug
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}
