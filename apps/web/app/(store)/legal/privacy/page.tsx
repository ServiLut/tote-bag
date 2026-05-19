'use client';

import { useTranslation } from 'react-i18next';
import { COMPANY_INFO } from '@/utils/company-info';

const PRIVACY_COPY = {
  es: {
    title: 'Política de Privacidad',
    subtitle: 'Última actualización: 31 de Enero de 2026',
    sections: [
      {
        title: '1. Introducción',
        paragraphs: [
          `En ${COMPANY_INFO.name}, nos comprometemos a proteger su privacidad y a tratar sus datos personales con transparencia y responsabilidad. Esta Política de Privacidad describe cómo recopilamos, usamos y protegemos su información cuando visita nuestro sitio web o realiza compras con nosotros.`,
        ],
      },
      {
        title: '2. Información que Recopilamos',
        paragraphs: ['Podemos recopilar la siguiente información personal:'],
        bullets: [
          'Información de Contacto: Nombre, dirección de correo electrónico, número de teléfono y dirección de envío.',
          'Información de Compra: Detalles sobre los productos que compra, historial de pedidos y preferencias de pago.',
          'Información Técnica: Dirección IP, tipo de navegador, sistema operativo y datos de navegación a través de cookies.',
        ],
      },
      {
        title: '3. Finalidad del Tratamiento',
        paragraphs: ['Utilizamos su información personal para los siguientes fines:'],
        bullets: [
          'Procesar y entregar sus pedidos.',
          'Enviarle notificaciones sobre el estado de su compra.',
          'Mejorar nuestro sitio web y la experiencia del usuario.',
          'Cumplir con obligaciones legales y fiscales.',
          'Enviarle comunicaciones de marketing, si ha dado su consentimiento explícito.',
        ],
      },
      {
        title: '4. Compartir Información',
        paragraphs: [
          'No vendemos ni alquilamos su información personal a terceros. Solo compartimos su información con proveedores de servicios de confianza necesarios para operar nuestro negocio, como:',
        ],
        bullets: [
          'Empresas de logística y transporte para la entrega de pedidos.',
          'Pasarelas de pago para procesar transacciones seguras.',
          'Servicios de alojamiento web y análisis de datos.',
        ],
      },
      {
        title: '5. Seguridad de los Datos',
        paragraphs: [
          'Implementamos medidas de seguridad técnicas y organizativas adecuadas para proteger sus datos personales contra el acceso no autorizado, la pérdida o la alteración.',
        ],
      },
      {
        title: '6. Sus Derechos',
        paragraphs: [
          'De acuerdo con la legislación vigente, usted tiene derecho a acceder, rectificar, cancelar y oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, puede contactarnos a través de nuestro correo electrónico de soporte.',
        ],
      },
      {
        title: '7. Contacto',
        paragraphs: [
          `Si tiene preguntas sobre esta Política de Privacidad, contáctenos en:`,
          `Email: totebagbolsadetela@gmail.com`,
          `Dirección: ${COMPANY_INFO.address}`,
        ],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'Last updated: January 31, 2026',
    sections: [
      {
        title: '1. Introduction',
        paragraphs: [
          `At ${COMPANY_INFO.name}, we are committed to protecting your privacy and handling your personal data with transparency and responsibility. This Privacy Policy explains how we collect, use, and protect your information when you visit our website or make purchases with us.`,
        ],
      },
      {
        title: '2. Information We Collect',
        paragraphs: ['We may collect the following personal information:'],
        bullets: [
          'Contact Information: Name, email address, phone number, and shipping address.',
          'Purchase Information: Details about the products you buy, order history, and payment preferences.',
          'Technical Information: IP address, browser type, operating system, and browsing data through cookies.',
        ],
      },
      {
        title: '3. Purpose of Processing',
        paragraphs: ['We use your personal information for the following purposes:'],
        bullets: [
          'Process and deliver your orders.',
          'Send notifications about the status of your purchase.',
          'Improve our website and user experience.',
          'Comply with legal and tax obligations.',
          'Send marketing communications if you have provided explicit consent.',
        ],
      },
      {
        title: '4. Sharing Information',
        paragraphs: [
          'We do not sell or rent your personal information to third parties. We only share your information with trusted service providers required to operate our business, such as:',
        ],
        bullets: [
          'Logistics and transportation companies for order delivery.',
          'Payment gateways to process secure transactions.',
          'Web hosting and data analytics services.',
        ],
      },
      {
        title: '5. Data Security',
        paragraphs: [
          'We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, loss, or alteration.',
        ],
      },
      {
        title: '6. Your Rights',
        paragraphs: [
          'Under applicable law, you have the right to access, rectify, cancel, and object to the processing of your personal data. To exercise these rights, you may contact us through our support email.',
        ],
      },
      {
        title: '7. Contact',
        paragraphs: [
          'If you have questions about this Privacy Policy, contact us at:',
          'Email: totebagbolsadetela@gmail.com',
          `Address: ${COMPANY_INFO.address}`,
        ],
      },
    ],
  },
} as const;

interface LegalSection {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
}

export default function PrivacyPolicyPage() {
  const { i18n } = useTranslation();
  const copy = (i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? PRIVACY_COPY.en
    : PRIVACY_COPY.es;

  return (
    <div className="space-y-8 text-body">
      <div className="border-b border-theme pb-6">
        <h1 className="mb-2 text-4xl font-serif font-bold text-primary">
          {copy.title}
        </h1>
        <p className="text-muted">{copy.subtitle}</p>
      </div>

      {(copy.sections as readonly LegalSection[]).map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="list-disc space-y-2 pl-5 marker:text-primary">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
