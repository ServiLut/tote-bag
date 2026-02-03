import { COMPANY_INFO } from '@/utils/company-info';

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-8 text-body">
      <div className="border-b border-theme pb-6">
        <h1 className="text-4xl font-serif font-bold text-primary mb-2">Política de Privacidad</h1>
        <p className="text-muted">Última actualización: 31 de Enero de 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">1. Introducción</h2>
        <p>
          En <strong>{COMPANY_INFO.name}</strong>, nos comprometemos a proteger su privacidad y a tratar sus datos personales con transparencia y responsabilidad. Esta Política de Privacidad describe cómo recopilamos, usamos y protegemos su información cuando visita nuestro sitio web o realiza compras con nosotros.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">2. Información que Recopilamos</h2>
        <p>Podemos recopilar la siguiente información personal:</p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li><strong>Información de Contacto:</strong> Nombre, dirección de correo electrónico, número de teléfono y dirección de envío.</li>
          <li><strong>Información de Compra:</strong> Detalles sobre los productos que compra, historial de pedidos y preferencias de pago.</li>
          <li><strong>Información Técnica:</strong> Dirección IP, tipo de navegador, sistema operativo y datos de navegación a través de cookies.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">3. Finalidad del Tratamiento</h2>
        <p>Utilizamos su información personal para los siguientes fines:</p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li>Procesar y entregar sus pedidos.</li>
          <li>Enviarle notificaciones sobre el estado de su compra.</li>
          <li>Mejorar nuestro sitio web y la experiencia del usuario.</li>
          <li>Cumplir con obligaciones legales y fiscales.</li>
          <li>Enviarle comunicaciones de marketing, si ha dado su consentimiento explícito.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">4. Compartir Información</h2>
        <p>
          No vendemos ni alquilamos su información personal a terceros. Solo compartimos su información con proveedores de servicios de confianza necesarios para operar nuestro negocio, como:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li>Empresas de logística y transporte para la entrega de pedidos.</li>
          <li>Pasarelas de pago para procesar transacciones seguras.</li>
          <li>Servicios de alojamiento web y análisis de datos.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">5. Seguridad de los Datos</h2>
        <p>
          Implementamos medidas de seguridad técnicas y organizativas adecuadas para proteger sus datos personales contra el acceso no autorizado, la pérdida o la alteración.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">6. Sus Derechos</h2>
        <p>
          De acuerdo con la legislación vigente, usted tiene derecho a acceder, rectificar, cancelar y oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, puede contactarnos a través de nuestro correo electrónico de soporte.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">7. Contacto</h2>
        <p>
          Si tiene preguntas sobre esta Política de Privacidad, contáctenos en: <br />
          <strong>Email:</strong> {COMPANY_INFO.email.privacy} <br />
          <strong>Dirección:</strong> {COMPANY_INFO.address}
        </p>
      </section>
    </div>
  );
}
