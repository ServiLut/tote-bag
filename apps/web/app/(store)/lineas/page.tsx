import Link from 'next/link';
import { Leaf, ShoppingBag, Star, Briefcase, ArrowRight } from 'lucide-react';

const lines = [
  {
    name: 'Línea ECO',
    icon: Leaf,
    description: 'Sostenibilidad al alcance de todos. Materiales reciclados y procesos optimizados.',
    features: ['Algodón reciclado', 'Tintas base agua', 'Precio competitivo'],
    color: 'text-green-600',
    bg: 'bg-green-50'
  },
  {
    name: 'Línea COMERCIAL',
    icon: ShoppingBag,
    description: 'Equilibrio perfecto entre durabilidad y diseño para el uso diario.',
    features: ['Resistencia superior', 'Variedad de colores', 'Ideal para retail'],
    color: 'text-blue-600',
    bg: 'bg-blue-50'
  },
  {
    name: 'Línea PREMIUM',
    icon: Star,
    description: 'Acabados de lujo y materiales seleccionados para quienes buscan lo mejor.',
    features: ['Algodón orgánico certificado', 'Bordados de alta definición', 'Diseño exclusivo'],
    color: 'text-amber-600',
    bg: 'bg-amber-50'
  }
];

export default function LineasPage() {
  return (
    <div className="bg-base min-h-screen py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-primary mb-4">Nuestras Líneas de Producción</h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Desde piezas individuales en stock hasta grandes producciones corporativas, tenemos una solución diseñada para ti.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {lines.map((line) => (
            <div key={line.name} className="flex flex-col bg-white border border-theme rounded-lg p-8 transition-all hover:shadow-xl hover:-translate-y-1">
              <div className={`w-12 h-12 ${line.bg} ${line.color} rounded-full flex items-center justify-center mb-6`}>
                <line.icon size={24} />
              </div>
              <h3 className="text-xl font-bold text-primary mb-4">{line.name}</h3>
              <p className="text-muted text-sm mb-6 flex-grow">{line.description}</p>
              <ul className="space-y-3 mb-8">
                {line.features.map((feature) => (
                  <li key={feature} className="flex items-center text-xs font-medium text-muted">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full mr-2"></div>
                    {feature}
                  </li>
                ))}
              </ul>
              {line.name === 'Línea CORPORATIVA' ? (
                <Link 
                  href="/corporativo" 
                  className="w-full py-3 bg-primary text-white text-center rounded text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Consultar B2B
                </Link>
              ) : (
                <Link 
                  href="/catalog" 
                  className="w-full py-3 border border-primary text-primary text-center rounded text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  Ver Productos <ArrowRight size={14} />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
