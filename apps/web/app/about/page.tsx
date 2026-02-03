import Image from 'next/image';
import { COMPANY_INFO } from '@/utils/company-info';
import { Leaf, Handshake, Infinity } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="bg-base min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[60vh] w-full flex items-center justify-center overflow-hidden">
        <Image
          src="/tote_bag_lifestyle.png" // Reusing existing image or placeholder
          alt="Artesanos trabajando"
          fill
          className="object-cover opacity-90"
          priority
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
          <span className="uppercase tracking-[0.2em] text-sm font-medium mb-4 block">Nuestra Historia</span>
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6">
            Tejiendo un futuro sostenible.
          </h1>
          <p className="text-xl md:text-2xl font-light opacity-90 max-w-2xl mx-auto">
            Creemos que la moda puede ser bella, funcional y ética al mismo tiempo.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-24 px-4 container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl font-serif font-bold text-primary">Más que una bolsa, un movimiento.</h2>
            <div className="w-20 h-1 bg-secondary" />
            <p className="text-lg text-muted leading-relaxed">
              En <strong>{COMPANY_INFO.name}</strong>, nacimos con una misión simple pero ambiciosa: eliminar el uso de bolsas plásticas de un solo uso en Colombia, sin sacrificar el estilo.
            </p>
            <p className="text-lg text-muted leading-relaxed">
              Lo que comenzó en 2024 como un pequeño taller en Bogotá, se ha convertido en una comunidad de personas conscientes que eligen calidad sobre cantidad. Cada tote bag que fabricamos lleva consigo horas de dedicación, materiales seleccionados y el compromiso de reducir nuestra huella ambiental.
            </p>
          </div>
          <div className="relative h-[500px] w-full bg-surface rounded-lg overflow-hidden shadow-xl">
             {/* Placeholder for mission image */}
             <div className="absolute inset-0 bg-secondary/10 flex items-center justify-center">
                <span className="text-muted font-serif italic text-2xl">Imagen del Taller</span>
             </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-surface py-24 px-4 border-y border-theme">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-serif font-bold text-primary mb-16">Nuestros Pilares</h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-secondary/20 rounded-full mx-auto flex items-center justify-center mb-6">
                <Leaf className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-primary">100% Ecológico</h3>
              <p className="text-muted">
                Utilizamos exclusivamente algodón orgánico certificado y tintas a base de agua, libres de químicos nocivos para el planeta.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-accent/20 rounded-full mx-auto flex items-center justify-center mb-6">
                <Handshake className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-primary">Comercio Justo</h3>
              <p className="text-muted">
                Trabajamos directamente con artesanos locales, garantizando salarios dignos y condiciones laborales seguras y éticas.
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center mb-6">
                <Infinity className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary">Durabilidad</h3>
              <p className="text-muted">
                Diseñamos productos para durar años, no temporadas. Una tote bag nuestra reemplaza hasta 500 bolsas plásticas al año.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team/Contact Section */}
      <section className="py-24 px-4 container mx-auto max-w-4xl text-center">
        <h2 className="text-4xl font-serif font-bold text-primary mb-6">Únete al cambio</h2>
        <p className="text-lg text-muted mb-10 max-w-2xl mx-auto">
          ¿Tienes preguntas sobre nuestro proceso o quieres colaborar con nosotros? Nos encantaría escucharte.
        </p>
        <div className="bg-primary text-base-color p-8 rounded-lg inline-block text-left shadow-lg">
          <p className="mb-2"><strong>Email:</strong> {COMPANY_INFO.email.support}</p>
          <p className="mb-2"><strong>Teléfono:</strong> {COMPANY_INFO.phone}</p>
          <p><strong>Ubicación:</strong> {COMPANY_INFO.address}</p>
        </div>
      </section>
    </div>
  );
}

