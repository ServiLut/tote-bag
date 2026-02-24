import { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, ArrowRight, Paintbrush, ShieldCheck, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Personaliza tu Tote Bag | Diseño Único',
  description: 'Crea una tote bag única con nuestro configurador avanzado. Elige línea, tamaño, material y técnica de impresión.',
};

export default function PersonalizaPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto space-y-8 mb-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 text-accent rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
          <Sparkles className="w-3 h-3" />
          Configurador Premium
        </div>
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-primary tracking-tighter leading-tight">
          Diseña tu propia <br/> historia.
        </h1>
        <p className="text-xl text-muted font-light leading-relaxed">
          No te conformes con lo estándar. Nuestra plataforma te permite configurar cada detalle de tu tote bag, desde la resistencia de la lona hasta el tipo de bordado.
        </p>
        <div className="pt-4">
          <Link href="/personaliza/configurador" className="btn-primary px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs inline-flex items-center gap-2 shadow-xl shadow-primary/20 hover:-translate-y-1 transition-all">
            Empezar a Diseñar <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-24">
        <div className="p-10 bg-surface rounded-3xl border border-theme shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
            <Paintbrush className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-primary">Control Total</h3>
          <p className="text-muted text-sm leading-relaxed">
            Elige entre 4 líneas de producto, 3 tamaños y múltiples calidades de algodón orgánico y lona industrial.
          </p>
        </div>
        <div className="p-10 bg-surface rounded-3xl border border-theme shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-primary">Garantía de Calidad</h3>
          <p className="text-muted text-sm leading-relaxed">
            Nuestros maestros artesanos revisan cada configuración para asegurar que el resultado final sea perfecto y duradero.
          </p>
        </div>
        <div className="p-10 bg-surface rounded-3xl border border-theme shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-primary">Producción Ágil</h3>
          <p className="text-muted text-sm leading-relaxed">
            Una vez finalices tu diseño, entra en nuestra línea de producción optimizada para que lo recibas en tiempo récord.
          </p>
        </div>
      </div>

      {/* Corporate Call to Action */}
      <div className="bg-primary text-base-color p-12 lg:p-20 rounded-[3rem] overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent rounded-full filter blur-[120px] opacity-20 -mr-48 -mt-48 group-hover:opacity-30 transition-opacity"></div>
        
        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="text-accent font-black uppercase text-[10px] tracking-[0.3em]">Soluciones Corporativas</span>
            <h2 className="text-4xl md:text-5xl font-serif font-bold leading-tight">¿Necesitas personalización por volumen?</h2>
            <p className="text-lg opacity-80 font-light">
              Para pedidos empresariales de más de 50 unidades, ofrecemos descuentos escalonados y opciones exclusivas de branding con QR integrado.
            </p>
          </div>
          <div className="flex md:justify-end">
            <Link href="/b2b" className="bg-base text-primary px-10 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-2xl hover:bg-accent hover:text-white transition-all">
              Ver Cotización B2B
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
