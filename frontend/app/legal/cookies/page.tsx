import { COMPANY_INFO } from '@/utils/company-info';

export default function CookiePolicyPage() {
  return (
    <div className="space-y-8 text-body">
      <div className="border-b border-theme pb-6">
        <h1 className="text-4xl font-serif font-bold text-primary mb-2">Política de Cookies</h1>
        <p className="text-muted">Última actualización: 31 de Enero de 2026</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que los sitios web almacenan en su ordenador, teléfono inteligente o tableta cuando usted los visita. Estos archivos permiten que el sitio web &quot;recuerde&quot; sus acciones y preferencias (como el inicio de sesión, el idioma, el tamaño de la fuente y otras preferencias de visualización) durante un período de tiempo, para que no tenga que volver a introducirlos cada vez que regrese al sitio o navegue de una página a otra.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">2. ¿Cómo utilizamos las cookies?</h2>
        <p>
          En <strong>{COMPANY_INFO.name}</strong> utilizamos cookies para mejorar su experiencia de navegación y entender cómo se utiliza nuestro sitio web. Específicamente, las usamos para:
        </p>
        <ul className="list-disc pl-5 space-y-2 marker:text-primary">
          <li><strong>Cookies Técnicas:</strong> Esenciales para que el sitio web funcione correctamente (ej. mantener los productos en su carrito de compras).</li>
          <li><strong>Cookies de Preferencia:</strong> Permiten recordar información que cambia el aspecto o el comportamiento del sitio (ej. su idioma preferido).</li>
          <li><strong>Cookies de Análisis:</strong> Nos ayudan a comprender cómo interactúan los visitantes con el sitio web, recopilando y reportando información de forma anónima.</li>
          <li><strong>Cookies de Marketing:</strong> Se utilizan para rastrear a los visitantes a través de las webs con la intención de mostrar anuncios que sean relevantes y atractivos.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">3. Control de Cookies</h2>
        <p>
          Usted puede controlar y/o eliminar las cookies según desee. Puede eliminar todas las cookies que ya están en su ordenador y puede configurar la mayoría de los navegadores para que no se acepten. Sin embargo, si lo hace, es posible que tenga que ajustar manualmente algunas preferencias cada vez que visite un sitio y que algunos servicios y funcionalidades no funcionen.
        </p>
        <p>
          En nuestro banner de consentimiento inicial, usted puede elegir aceptar todas las cookies o rechazar las que no son estrictamente necesarias.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">4. Cookies de Terceros</h2>
        <p>
          En algunos casos, también utilizamos cookies proporcionadas por terceros de confianza. Por ejemplo, utilizamos <strong>Supabase</strong> para la autenticación y gestión de sesiones, y podemos utilizar herramientas de análisis como Google Analytics. Estos terceros tienen sus propias políticas de privacidad y cookies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">5. Actualizaciones de esta política</h2>
        <p>
          Es posible que actualicemos nuestra Política de Cookies de vez en cuando para reflejar, por ejemplo, cambios en las cookies que utilizamos o por otras razones operativas, legales o reglamentarias. Por lo tanto, le rogamos que visite esta página periódicamente para mantenerse informado sobre nuestro uso de las cookies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">6. Más Información</h2>
        <p>
          Si tiene alguna duda sobre el uso que hacemos de las cookies u otras tecnologías, puede enviarnos un correo electrónico a <strong>{COMPANY_INFO.email.privacy}</strong>.
        </p>
      </section>
    </div>
  );
}
