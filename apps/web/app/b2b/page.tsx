import Navbar from '@/components/store/Navbar';
import B2BQuoteForm from '@/components/b2b/B2BQuoteForm';
import Footer from '@/components/store/Footer';
import { Building2, QrCode, Sparkles } from 'lucide-react';

export default function B2BPage() {
  return (
    <div className="min-h-screen bg-base transition-colors duration-300 flex flex-col">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column: Info & Value Prop */}
          <div className="space-y-10 animate-in slide-in-from-left duration-500">
            <div>
              <span className="inline-block px-3 py-1 bg-secondary text-white text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
                Tote Bag Corporate
              </span>
              <h1 className="text-4xl md:text-6xl font-serif text-primary leading-tight mb-6">
                Tu marca, <br/> en movimiento.
              </h1>
              <p className="text-lg text-muted leading-relaxed">
                Transforma el merchandising de tu empresa en una declaración de sostenibilidad. 
                Personalizamos tote bags premium con tu identidad visual y tecnología QR integrada.
              </p>
            </div>

            <div className="grid gap-8">
              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Sparkles className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">Calidad Premium</h3>
                  <p className="text-sm text-muted">
                    Algodón 100% orgánico o lona de alta resistencia. Impresión DTF o serigrafía de larga duración que no se cuartea.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <QrCode className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">Conexión Digital (QR)</h3>
                  <p className="text-sm text-muted">
                    Cada bolsa incluye un QR escaneable integrado en el diseño que lleva a tus clientes directo a tu WhatsApp, Instagram o Web.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center shrink-0 border border-theme">
                  <Building2 className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-primary mb-1">Volumen y Logística</h3>
                  <p className="text-sm text-muted">
                    Capacidad de producción de +1000 unidades semanales. Envíos asegurados a todo el país con tracking empresarial.
                  </p>
                </div>
              </div>
            </div>

            {/* Client Logos / Trust Badges could go here */}
            <div className="pt-8 border-t border-theme">
              <p className="text-xs text-muted uppercase tracking-widest mb-4">Confían en nosotros</p>
              <div className="flex gap-6 opacity-50 grayscale mix-blend-multiply dark:invert dark:mix-blend-normal">
                 {/* Placeholders for client logos */}
                 <div className="h-8 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                 <div className="h-8 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
                 <div className="h-8 w-24 bg-zinc-300 dark:bg-zinc-700 rounded"></div>
              </div>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="relative animate-in slide-in-from-right duration-500 delay-100">
            {/* Decoration Element */}
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-accent rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-20 animate-pulse"></div>
            
            <B2BQuoteForm />
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}
