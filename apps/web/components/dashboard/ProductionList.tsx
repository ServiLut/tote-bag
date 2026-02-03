'use client';

import { useMemo } from 'react';
import { Printer, Clock, AlertCircle, CheckCircle2, Download, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Mock Data Types matching the logical structure
interface OrderItem {
  sku: string;
  productName: string;
  color: string; // Extracted from SKU or relation
  quantity: number;
}

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  createdAt: string; // ISO String
  status: 'PENDIENTE' | 'PAGADO' | 'EN_PRODUCCION' | 'ENVIADO';
  items: OrderItem[];
}

// Mock Data
const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    orderNumber: 1001,
    customerName: 'Ana María Polo',
    createdAt: '2026-01-29T09:30:00', // Before 12:00 (Priority)
    status: 'PAGADO',
    items: [
      { sku: 'TB-VERANO-SOL-CRUDO', productName: 'Tote Sol Radiante', color: 'Crudo', quantity: 2 },
      { sku: 'TB-VERANO-LUNA-NEGRO', productName: 'Tote Luna Mística', color: 'Negro', quantity: 1 },
    ],
  },
  {
    id: '2',
    orderNumber: 1002,
    customerName: 'Carlos Vives',
    createdAt: '2026-01-29T13:15:00', // After 12:00
    status: 'PAGADO',
    items: [
      { sku: 'TB-VERANO-SOL-CRUDO', productName: 'Tote Sol Radiante', color: 'Crudo', quantity: 1 },
    ],
  },
  {
    id: '3',
    orderNumber: 1003,
    customerName: 'Shakira Mebarak',
    createdAt: '2026-01-29T10:45:00', // Before 12:00 (Priority)
    status: 'PAGADO',
    items: [
      { sku: 'TB-MASCOTAS-GATO-BEIGE', productName: 'Tote Gato Zen', color: 'Beige', quantity: 3 },
    ],
  },
  {
    id: '4',
    orderNumber: 1004,
    customerName: 'Juanes',
    createdAt: '2026-01-28T16:00:00', // Yesterday (Priority implicitly if not shipped)
    status: 'EN_PRODUCCION', // Should be filtered out or handled differently
    items: [
      { sku: 'TB-VERANO-SOL-CRUDO', productName: 'Tote Sol Radiante', color: 'Crudo', quantity: 1 },
    ],
  },
];

interface ProductionBatch {
  id: string; // Composite key
  productName: string;
  color: string;
  totalQuantity: number;
  items: {
    orderNumber: number;
    quantity: number;
    isPriority: boolean;
    customer: string;
    createdAt: string;
  }[];
}

export const ProductionList = () => {
  // Logic: 12:00 PM Cut-off Check
  const isPriorityOrder = (dateString: string) => {
    const date = new Date(dateString);
    // Simple check: If hour < 12. In real app, check if it's "today" as well.
    // For this demo, we assume the list shows active pending orders.
    return date.getHours() < 12;
  };

  // Grouping Logic
  const productionBatches = useMemo(() => {
    const batches: Record<string, ProductionBatch> = {};

    MOCK_ORDERS
      .filter(o => o.status === 'PAGADO') // Only paid orders
      .forEach(order => {
        const isPriority = isPriorityOrder(order.createdAt);
        
        order.items.forEach(item => {
          const key = `${item.productName}-${item.color}`;
          
          if (!batches[key]) {
            batches[key] = {
              id: key,
              productName: item.productName,
              color: item.color,
              totalQuantity: 0,
              items: []
            };
          }

          batches[key].totalQuantity += item.quantity;
          batches[key].items.push({
            orderNumber: order.orderNumber,
            quantity: item.quantity,
            isPriority,
            customer: order.customerName,
            createdAt: order.createdAt
          });
        });
      });

    // Sort: Priority items inside batch? Or Sort batches by size?
    // Let's sort items inside batch by priority first
    Object.values(batches).forEach(batch => {
      batch.items.sort((a, b) => (a.isPriority === b.isPriority ? 0 : a.isPriority ? -1 : 1));
    });

    return Object.values(batches);
  }, []);

  // Export Logic
  const handleExport = () => {
    const header = "Producto,Color,Cantidad Total,Prioridad (Antes 12pm)\n";
    const rows = productionBatches.map(batch => {
      const priorityCount = batch.items.filter(i => i.isPriority).reduce((acc, curr) => acc + curr.quantity, 0);
      return `"${batch.productName}","${batch.color}",${batch.totalQuantity},${priorityCount}`;
    }).join("\n");

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `produccion-corte-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="w-full bg-[#F5F5F0] min-h-screen p-8 text-[#171717] font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Producción Diaria</h1>
            <p className="text-gray-600">Gestión de lotes y priorización de pedidos.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 flex items-center gap-2 text-sm shadow-sm">
              <Clock size={16} className="text-gray-500" />
              <span>Cut-off: <strong>12:00 PM</strong></span>
            </div>
            
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-all shadow-md active:transform active:scale-95"
            >
              <Download size={18} />
              Exportar Lotes
            </button>
          </div>
        </header>

        {/* Stats / Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total a Producir</p>
                <p className="text-3xl font-bold">
                  {productionBatches.reduce((acc, b) => acc + b.totalQuantity, 0)}
                  <span className="text-sm font-normal text-gray-400 ml-1">unidades</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Prioridad Alta</p>
                <p className="text-3xl font-bold">
                   {productionBatches.reduce((acc, b) => acc + b.items.filter(i => i.isPriority).reduce((s, i) => s + i.quantity, 0), 0)}
                   <span className="text-sm font-normal text-gray-400 ml-1">unidades</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* List Logic */}
        <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Printer size={20} />
                Lotes de Impresión (Agrupado)
            </h2>

            {productionBatches.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                    <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Todo listo. No hay pedidos pendientes de producción.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {productionBatches.map((batch) => (
                        <div key={batch.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Batch Header */}
                            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-bold">{batch.productName}</h3>
                                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md uppercase tracking-wide">
                                            {batch.color}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500">SKU Base: TB-{batch.productName.substring(0,3).toUpperCase()}-...</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-bold">{batch.totalQuantity}</span>
                                    <span className="text-xs text-gray-500 uppercase font-medium">Total a Imprimir</span>
                                </div>
                            </div>

                            {/* Batch Items */}
                            <div className="divide-y divide-gray-100">
                                {batch.items.map((item, idx) => (
                                    <div key={idx} className={cn(
                                        "p-4 flex items-center justify-between hover:bg-gray-50 transition-colors",
                                        item.isPriority ? "bg-amber-50/40 hover:bg-amber-50" : ""
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                                                item.isPriority ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                                            )}>
                                                {item.quantity}x
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm flex items-center gap-2">
                                                    Orden #{item.orderNumber}
                                                    {item.isPriority && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                                            <AlertCircle size={10} />
                                                            PRIORIDAD (12 PM)
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500">{item.customer}</p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-400 font-mono">
                                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
