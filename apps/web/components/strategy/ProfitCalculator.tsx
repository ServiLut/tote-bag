'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types/product';
import { Loader2, Calculator, TrendingUp, DollarSign, Percent } from 'lucide-react';

export default function ProfitCalculator() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [suggestedPrice, setSuggestedPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [avgCost, setAvgCost] = useState<number>(0);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_URL}/catalog/products`);
        if (res.ok) {
          const body = await res.json();
          setProducts(body.data || []);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [API_URL]);

  useEffect(() => {
    if (selectedProductId) {
      const product = products.find(p => p.id === selectedProductId);
      // Use costPrice as a fallback for now
      setAvgCost(product?.costPrice || 0);
      setSuggestedPrice(product?.basePrice || 0);
    }
  }, [selectedProductId, products]);

  const grossProfit = suggestedPrice - avgCost;
  const marginPercentage = suggestedPrice > 0 ? (grossProfit / suggestedPrice) * 100 : 0;

  return (
    <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-primary">Calculadora de Márgenes</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
              Seleccionar Producto
            </label>
            {loading ? (
              <div className="flex items-center gap-2 text-muted py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Cargando productos...</span>
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-base border border-theme rounded-xl px-4 py-3 text-primary font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              >
                <option value="">Seleccione un producto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
              Costo Promedio (Lotes Activos)
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</div>
              <input
                type="number"
                readOnly
                value={avgCost}
                className="w-full bg-theme/5 border border-theme rounded-xl pl-8 pr-4 py-3 text-primary font-bold cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted font-medium italic">
              Basado en el sistema FIFO de lotes de compra.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">
              Precio de Venta Sugerido
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">$</div>
              <input
                type="number"
                value={suggestedPrice}
                onChange={(e) => setSuggestedPrice(Number(e.target.value))}
                className="w-full bg-base border border-theme rounded-xl pl-8 pr-4 py-3 text-primary font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="bg-primary/5 rounded-2xl p-6 flex flex-col justify-center space-y-6 border border-primary/10">
          <div>
            <p className="text-sm font-bold text-primary/60 uppercase tracking-widest mb-1">Utilidad Bruta</p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-primary" />
              <span className="text-3xl font-black text-primary">
                {grossProfit.toLocaleString('es-CO')}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-primary/60 uppercase tracking-widest mb-1">Margen de Contribución</p>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
              <span className={`text-3xl font-black ${marginPercentage > 30 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {marginPercentage.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-primary/10">
            <div className={`text-xs font-bold px-3 py-2 rounded-lg text-center ${
              marginPercentage > 40 ? 'bg-emerald-100 text-emerald-700' : 
              marginPercentage > 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              {marginPercentage > 40 ? 'MARGEN EXCELENTE' : 
               marginPercentage > 20 ? 'MARGEN ACEPTABLE' : 'ALERTA: MARGEN BAJO'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
