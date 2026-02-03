'use client';

import Link from 'next/link';
import { COMPANY_INFO } from '@/utils/company-info';

export default function Footer() {
  return (
    <footer className="bg-primary text-base-color py-16 px-4 border-t border-theme transition-colors duration-300 mt-auto">
      {/* 
          Usamos text-base-color (que definiremos en globals.css) 
          para que siempre sea el color opuesto al fondo principal.
      */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2 space-y-6">
          <h3 className="text-2xl font-serif font-bold tracking-tighter">{COMPANY_INFO.name}</h3>
          <p className="opacity-90 text-sm max-w-xs leading-relaxed">
            Diseño minimalista y sostenible para la vida moderna. Hecho a mano en Colombia con amor y respeto por el medio ambiente.
          </p>
        </div>
        <div>
          <h4 className="font-bold mb-6 text-xs uppercase tracking-[0.2em]">Navegación</h4>
          <ul className="space-y-4 text-sm opacity-90">
            <li><Link href="/catalog" className="hover:opacity-100 transition-opacity font-medium">Tienda</Link></li>
            <li><Link href="/about" className="hover:opacity-100 transition-opacity font-medium">Nosotros</Link></li>
            <li><Link href="#" className="hover:opacity-100 transition-opacity font-medium">Sostenibilidad</Link></li>
          </ul>
        </div>
        <div>
           <h4 className="font-bold mb-6 text-xs uppercase tracking-[0.2em]">Soporte</h4>
           <ul className="space-y-4 text-sm opacity-90">
            <li><Link href="/legal/privacy" className="hover:opacity-100 transition-opacity font-medium">Privacidad</Link></li>
            <li><Link href="/legal/data-processing" className="hover:opacity-100 transition-opacity font-medium">Tratamiento de Datos</Link></li>
            <li><Link href="#" className="hover:opacity-100 transition-opacity font-medium">Envíos</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-theme/20 text-[10px] opacity-70 uppercase tracking-widest flex flex-col md:flex-row justify-between items-center gap-4">
        <span>&copy; {new Date().getFullYear()} {COMPANY_INFO.name}. Todos los derechos reservados.</span>
        <span>Hecho en Colombia</span>
      </div>
    </footer>
  );
}
