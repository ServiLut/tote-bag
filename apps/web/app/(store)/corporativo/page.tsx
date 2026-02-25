import { MessageCircle, CheckCircle, Factory, ShieldCheck, Zap } from 'lucide-react';

export default function CorporativoPage() {
  const WHATSAPP_URL = "https://wa.me/573000000000?text=Hola,%20me%20interesa%20información%20sobre%20pedidos%20corporativos.";

  return (
    <div className="bg-base min-h-screen transition-colors duration-300">
      {/* Hero Section */}
      <section className="bg-primary text-white py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-serif mb-6">Área Corporativa & B2B</h1>
          <p className="text-xl opacity-90 max-w-3xl mx-auto font-light leading-relaxed">
            Soluciones de producción bajo pedido para marcas que buscan impacto, calidad y sostenibilidad a gran escala.
          </p>
          <div className="mt-10">
            <a 
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-10 py-4 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105"
            >
              <MessageCircle size={24} />
              Hablar con un Asesor
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Factory size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">Producción a Medida</h3>
            <p className="text-muted leading-relaxed">
              Personalizamos dimensiones, materiales y técnicas de impresión según los requerimientos específicos de tu marca.
            </p>
          </div>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">Calidad Garantizada</h3>
            <p className="text-muted leading-relaxed">
              Estándares rigurosos de control de calidad en cada etapa, desde la selección de la fibra hasta el empaque final.
            </p>
          </div>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-accent/10 text-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap size={32} />
            </div>
            <h3 className="text-2xl font-serif text-primary">Tiempos Optimizados</h3>
            <p className="text-muted leading-relaxed">
              Gestión logística eficiente para cumplir con tus plazos de entrega, ya sea para eventos o reabastecimiento de retail.
            </p>
          </div>
        </div>
      </section>

      {/* WhatsApp CTA Section */}
      <section className="py-20 bg-white border-y border-theme">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-serif text-primary mb-8">¿Listo para iniciar tu producción?</h2>
          <div className="bg-slate-50 p-10 rounded-3xl border border-theme flex flex-col items-center">
            <p className="text-lg text-muted mb-8">
              Cuéntanos tu proyecto y recibe una cotización personalizada en menos de 24 horas hábiles.
            </p>
            <div className="space-y-4 w-full max-w-md">
              <div className="flex items-center gap-3 text-sm text-primary font-bold">
                <CheckCircle className="text-green-500" size={20} />
                Descuentos por volumen (B2B)
              </div>
              <div className="flex items-center gap-3 text-sm text-primary font-bold">
                <CheckCircle className="text-green-500" size={20} />
                Muestras físicas previas a producción
              </div>
              <div className="flex items-center gap-3 text-sm text-primary font-bold">
                <CheckCircle className="text-green-500" size={20} />
                Asesoría en diseño e impresión
              </div>
            </div>
            <a 
              href={WHATSAPP_URL}
              className="mt-12 inline-flex items-center gap-2 px-8 py-4 bg-primary text-white rounded font-bold uppercase tracking-widest hover:bg-primary/90 transition-all"
            >
              Iniciar Conversación <MessageCircle size={20} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
