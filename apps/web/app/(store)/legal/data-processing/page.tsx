'use client';

import { useTranslation } from 'react-i18next';
import { COMPANY_INFO } from '@/utils/company-info';

const DATA_PROCESSING_COPY = {
  es: {
    title: 'Política de Tratamiento de Datos',
    subtitle: 'En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013',
    sections: [
      {
        title: '1. Marco Legal',
        paragraphs: [
          `${COMPANY_INFO.name} (en adelante "La Empresa"), en cumplimiento de lo dispuesto por la Ley 1581 de 2012 y su decreto reglamentario 1377 de 2013, adopta la presente política para el tratamiento de datos personales. Esta política aplica a toda la información personal registrada en las bases de datos de La Empresa.`,
        ],
      },
      {
        title: '2. Principios Rectores',
        paragraphs: [
          'En el desarrollo, interpretación y aplicación de la presente política, se aplicarán de manera armónica e integral los siguientes principios:',
        ],
        bullets: [
          'Principio de Legalidad: El tratamiento de datos es una actividad reglada que debe sujetarse a lo establecido en la ley.',
          'Principio de Finalidad: El tratamiento debe obedecer a una finalidad legítima de acuerdo con la Constitución y la Ley.',
          'Principio de Libertad: El tratamiento sólo puede ejercerse con el consentimiento, previo, expreso e informado del titular.',
          'Principio de Veracidad: La información sujeta a tratamiento debe ser veraz, completa, exacta, actualizada, comprobable y comprensible.',
          'Principio de Transparencia: Se garantiza el derecho del titular a obtener información acerca de la existencia de datos que le conciernan.',
          'Principio de Seguridad: La información se manejará con las medidas técnicas, humanas y administrativas necesarias para otorgar seguridad.',
          'Principio de Confidencialidad: Todas las personas que intervengan en el tratamiento de datos están obligadas a garantizar la reserva de la información.',
        ],
      },
      {
        title: '3. Derechos de los Titulares (ARCO)',
        paragraphs: ['Los titulares de los datos personales tienen los siguientes derechos:'],
        bullets: [
          'Acceso: Conocer, actualizar y rectificar sus datos personales.',
          'Prueba: Solicitar prueba de la autorización otorgada para el tratamiento de sus datos.',
          'Información: Ser informado sobre el uso que se le ha dado a sus datos personales.',
          'Queja: Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a lo dispuesto en la ley.',
          'Revocatoria: Revocar la autorización y/o solicitar la supresión del dato cuando no se respeten los principios, derechos y garantías constitucionales y legales.',
        ],
      },
      {
        title: '4. Autorización del Titular',
        paragraphs: [
          'La recolección, almacenamiento, uso, circulación o supresión de datos personales por parte de La Empresa requiere del consentimiento libre, previo, expreso e informado del titular de los mismos.',
          'Al aceptar nuestros términos en el momento del registro o compra, el usuario autoriza el tratamiento de sus datos para los fines especificados en nuestra Política de Privacidad.',
        ],
      },
      {
        title: '5. Atención de Peticiones y Reclamos',
        paragraphs: [
          'Para ejercer sus derechos, el titular puede contactar al área responsable del tratamiento de datos a través del correo electrónico totebagbolsadetela@gmail.com.',
          'La solicitud será atendida en un término máximo de quince (15) días hábiles contados a partir de la fecha de su recibo.',
        ],
      },
      {
        title: '6. Vigencia',
        paragraphs: [
          'La presente política rige a partir de su publicación. Las bases de datos tendrán una vigencia igual al tiempo en que se mantenga y utilice la información para las finalidades descritas en esta política.',
        ],
      },
    ],
  },
  en: {
    title: 'Data Processing Policy',
    subtitle: 'In compliance with Law 1581 of 2012 and Decree 1377 of 2013',
    sections: [
      {
        title: '1. Legal Framework',
        paragraphs: [
          `${COMPANY_INFO.name} (hereinafter "The Company"), in compliance with Law 1581 of 2012 and its regulatory Decree 1377 of 2013, adopts this policy for the processing of personal data. This policy applies to all personal information recorded in the Company databases.`,
        ],
      },
      {
        title: '2. Guiding Principles',
        paragraphs: [
          'In the development, interpretation, and application of this policy, the following principles will be applied harmoniously and comprehensively:',
        ],
        bullets: [
          'Legality Principle: Data processing is a regulated activity that must comply with the law.',
          'Purpose Principle: Processing must respond to a legitimate purpose in accordance with the Constitution and the Law.',
          'Freedom Principle: Processing may only be carried out with the prior, express, and informed consent of the data subject.',
          'Accuracy Principle: Information subject to processing must be truthful, complete, accurate, updated, verifiable, and understandable.',
          'Transparency Principle: The data subject has the right to obtain information about the existence of data concerning them.',
          'Security Principle: Information will be handled with the technical, human, and administrative measures necessary to provide security.',
          'Confidentiality Principle: All persons involved in data processing are required to guarantee the confidentiality of the information.',
        ],
      },
      {
        title: '3. Rights of Data Subjects (ARCO)',
        paragraphs: ['Holders of personal data have the following rights:'],
        bullets: [
          'Access: Know, update, and rectify your personal data.',
          'Proof: Request proof of the authorization granted for the processing of your data.',
          'Information: Be informed about how your personal data has been used.',
          'Complaint: File complaints before the Superintendence of Industry and Commerce for violations of the law.',
          'Revocation: Revoke authorization and/or request deletion of data when constitutional and legal principles, rights, and guarantees are not respected.',
        ],
      },
      {
        title: '4. Authorization of the Data Subject',
        paragraphs: [
          'The collection, storage, use, circulation, or deletion of personal data by the Company requires the free, prior, express, and informed consent of the data subject.',
          'By accepting our terms at the time of registration or purchase, the user authorizes the processing of their data for the purposes specified in our Privacy Policy.',
        ],
      },
      {
        title: '5. Requests and Claims',
        paragraphs: [
          'To exercise their rights, the data subject may contact the area responsible for data processing through the email totebagbolsadetela@gmail.com.',
          'The request will be answered within a maximum term of fifteen (15) business days counted from the date it is received.',
        ],
      },
      {
        title: '6. Validity',
        paragraphs: [
          'This policy becomes effective from its publication. Databases will remain valid for as long as the information is kept and used for the purposes described in this policy.',
        ],
      },
    ],
  },
} as const;

export default function DataProcessingPage() {
  const { i18n } = useTranslation();
  const copy = (i18n.resolvedLanguage || i18n.language).startsWith('en')
    ? DATA_PROCESSING_COPY.en
    : DATA_PROCESSING_COPY.es;

  return (
    <div className="space-y-8 text-body">
      <div className="border-b border-theme pb-6">
        <h1 className="mb-2 text-4xl font-serif font-bold text-primary">
          {copy.title}
        </h1>
        <p className="text-muted">{copy.subtitle}</p>
      </div>

      {copy.sections.map((section) => (
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
