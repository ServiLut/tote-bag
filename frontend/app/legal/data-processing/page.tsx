import { COMPANY_INFO } from '@/utils/company-info';

export default function DataProcessingPage() {
  return (
    <div className="space-y-8 text-body">
      <div className="border-b border-theme pb-6">
        <h1 className="text-4xl font-serif font-bold text-primary mb-2">Política de Tratamiento de Datos</h1>
        <p className="text-muted">En cumplimiento de la Ley 1581 de 2012 y el Decreto 1377 de 2013</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">1. Marco Legal</h2>
        <p>
          <strong>{COMPANY_INFO.name}</strong> (en adelante &quot;La Empresa&quot;), en cumplimiento de lo dispuesto por la Ley 1581 de 2012 y su decreto reglamentario 1377 de 2013, adopta la presente política para el tratamiento de datos personales. Esta política aplica a toda la información personal registrada en las bases de datos de La Empresa.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">2. Principios Rectores</h2>
        <p>
          En el desarrollo, interpretación y aplicación de la presente política, se aplicarán de manera armónica e integral los siguientes principios:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li><strong>Principio de Legalidad:</strong> El Tratamiento de datos es una actividad reglada que debe sujetarse a lo establecido en la ley.</li>
          <li><strong>Principio de Finalidad:</strong> El Tratamiento debe obedecer a una finalidad legítima de acuerdo con la Constitución y la Ley.</li>
          <li><strong>Principio de Libertad:</strong> El Tratamiento sólo puede ejercerse con el consentimiento, previo, expreso e informado del Titular.</li>
          <li><strong>Principio de Veracidad:</strong> La información sujeta a Tratamiento debe ser veraz, completa, exacta, actualizada, comprobable y comprensible.</li>
          <li><strong>Principio de Transparencia:</strong> Se garantiza el derecho del Titular a obtener información acerca de la existencia de datos que le conciernan.</li>
          <li><strong>Principio de Seguridad:</strong> La información se manejará con las medidas técnicas, humanas y administrativas necesarias para otorgar seguridad.</li>
          <li><strong>Principio de Confidencialidad:</strong> Todas las personas que intervengan en el Tratamiento de datos están obligadas a garantizar la reserva de la información.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">3. Derechos de los Titulares (ARCO)</h2>
        <p>
          Los titulares de los datos personales tienen los siguientes derechos:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li><strong>Acceso:</strong> Conocer, actualizar y rectificar sus datos personales.</li>
          <li><strong>Prueba:</strong> Solicitar prueba de la autorización otorgada para el tratamiento de sus datos.</li>
          <li><strong>Información:</strong> Ser informado sobre el uso que se le ha dado a sus datos personales.</li>
          <li><strong>Queja:</strong> Presentar ante la Superintendencia de Industria y Comercio quejas por infracciones a lo dispuesto en la ley.</li>
          <li><strong>Revocatoria:</strong> Revocar la autorización y/o solicitar la supresión del dato cuando no se respeten los principios, derechos y garantías constitucionales y legales.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">4. Autorización del Titular</h2>
        <p>
          La recolección, almacenamiento, uso, circulación o supresión de datos personales por parte de La Empresa requiere del consentimiento libre, previo, expreso e informado del titular de los mismos.
        </p>
        <p>
          Al aceptar nuestros términos en el momento del registro o compra, el usuario autoriza el tratamiento de sus datos para los fines especificados en nuestra Política de Privacidad.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">5. Atención de Peticiones y Reclamos</h2>
        <p>
          Para ejercer sus derechos, el titular puede contactar al área responsable del tratamiento de datos a través del correo electrónico <strong>{COMPANY_INFO.email.dataProtection}</strong>.
        </p>
        <p>
          La solicitud será atendida en un término máximo de quince (15) días hábiles contados a partir de la fecha de su recibo.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">6. Vigencia</h2>
        <p>
          La presente política rige a partir de su publicación. Las bases de datos tendrán una vigencia igual al tiempo en que se mantenga y utilice la información para las finalidades descritas en esta política.
        </p>
      </section>
    </div>
  );
}
