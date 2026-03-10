'use client';

import ProfitCalculator from '@/components/strategy/ProfitCalculator';
import { Calculator } from 'lucide-react';

export default function PricingStrategyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 md:p-12">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
            <Calculator className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Precios y Margenes</h1>
        </div>
        <p className="max-w-2xl font-medium text-muted">
          Analiza la rentabilidad de tus productos con costos manuales y define precios de venta estrategicos
          para distintos escenarios.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <ProfitCalculator />

        <div className="rounded-2xl border border-theme bg-surface p-8">
          <h3 className="mb-4 text-lg font-bold text-primary">Guia de Estrategia de Precios</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-sm font-bold uppercase tracking-wider text-emerald-500">Premium (&gt; 50%)</div>
              <p className="text-xs leading-relaxed text-muted">
                Productos con alta diferenciacion o marca fuerte. Permiten reinversion agresiva en marketing.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold uppercase tracking-wider text-amber-500">Comercial (30% - 50%)</div>
              <p className="text-xs leading-relaxed text-muted">
                Rango estandar para asegurar sostenibilidad operativa y cubrir gastos fijos.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-bold uppercase tracking-wider text-red-500">Volumen (&lt; 20%)</div>
              <p className="text-xs leading-relaxed text-muted">
                Estrategia de penetracion de mercado o liquidacion de inventario antiguo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
