'use client';

import ProfitCalculator from '@/components/strategy/ProfitCalculator';
import { Calculator } from 'lucide-react';

export default function PricingStrategyPage() {
  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary rounded-xl text-base-color shadow-lg shadow-primary/20">
            <Calculator className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Precios y Márgenes</h1>
        </div>
        <p className="text-muted font-medium max-w-2xl">
          Analiza la rentabilidad de tus productos basándote en los costos reales de adquisición (FIFO)
          y define precios de venta estratégicos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <ProfitCalculator />

        <div className="bg-surface border border-theme rounded-2xl p-8">
          <h3 className="text-lg font-bold text-primary mb-4">Guía de Estrategia de Precios</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-emerald-500 font-bold text-sm uppercase tracking-wider">Premium (&gt; 50%)</div>
              <p className="text-xs text-muted leading-relaxed">
                Productos con alta diferenciación o marca fuerte. Permiten reinversión agresiva en marketing.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-amber-500 font-bold text-sm uppercase tracking-wider">Comercial (30% - 50%)</div>
              <p className="text-xs text-muted leading-relaxed">
                Rango estándar para asegurar sostenibilidad operativa y cubrir gastos fijos.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-red-500 font-bold text-sm uppercase tracking-wider">Volumen (&lt; 20%)</div>
              <p className="text-xs text-muted leading-relaxed">
                Estrategia de penetración de mercado o liquidación de inventario antiguo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
