'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  Loader2, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  TrendingUp,
  FileSpreadsheet,
  Signature
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ClosingReport {
  period: { startDate: string; endDate: string };
  pnl: {
    grossSales: number;
    totalCOGS: number;
    grossProfit: number;
    opexByCategory: Record<string, number>;
    totalOpex: number;
    estimatedTaxes: number;
    netProfit: number;
  };
  inventoryValuation: number;
}

export default function ReportsPage() {
  const [report, setReport] = useState<ClosingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('CURRENT_MONTH');
  
  const [dates, setDates] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4001';

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/inventory/reporting/closing?startDate=${dates.start}&endDate=${dates.end}`);
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [dates, API_URL]);

  const handleRangeChange = (newRange: string) => {
    setRange(newRange);
    let start = new Date();
    let end = new Date();

    switch (newRange) {
      case 'CURRENT_MONTH':
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case 'LAST_MONTH':
        start = startOfMonth(subMonths(new Date(), 1));
        end = endOfMonth(subMonths(new Date(), 1));
        break;
      case 'YEAR_TO_DATE':
        start = startOfYear(new Date());
        end = new Date();
        break;
    }

    setDates({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = jsPDF();
    const pnl = report.pnl;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTE BAG CO.', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Reporte Contable Oficial - Estado de Resultados', 105, 28, { align: 'center' });
    doc.text(`Periodo: ${format(new Date(dates.start), 'dd/MM/yyyy')} al ${format(new Date(dates.end), 'dd/MM/yyyy')}`, 105, 34, { align: 'center' });

    // Table
    autoTable(doc, {
      startY: 45,
      head: [['Concepto', 'Monto']],
      body: [
        ['Ventas Brutas', formatCurrency(pnl.grossSales)],
        ['(-) Costo de Ventas (COGS)', formatCurrency(pnl.totalCOGS)],
        ['UTILIDAD BRUTA', formatCurrency(pnl.grossProfit)],
        ['(-) Gastos Operativos (OpEx)', formatCurrency(pnl.totalOpex)],
        ...Object.entries(pnl.opexByCategory).map(([cat, val]) => [`   > ${cat}`, formatCurrency(val)]),
        ['(-) Impuestos Estimados (19%)', formatCurrency(pnl.estimatedTaxes)],
        ['UTILIDAD NETA', formatCurrency(pnl.netProfit)],
      ],
      theme: 'striped',
      headStyles: { fillStyle: 'black' as any }, // Correct type hack
      styles: { fontStyle: 'bold' as any },
      columnStyles: { 1: { halign: 'right' as any } },
    });

    // Valuation
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.text(`Valorización de Inventario Actual: ${formatCurrency(report.inventoryValuation)}`, 14, finalY);

    // Signature
    doc.text('__________________________', 105, finalY + 40, { align: 'center' });
    doc.text('Firma de Responsabilidad', 105, finalY + 45, { align: 'center' });
    doc.text(`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 105, finalY + 50, { align: 'center' });

    doc.save(`Reporte_Contable_${dates.start}_${dates.end}.pdf`);
  };

  const exportExcel = () => {
    if (!report) return;
    const pnl = report.pnl;
    const data = [
      ['TOTE BAG CO. - REPORTE CONTABLE'],
      [`Periodo: ${dates.start} al ${dates.end}`],
      [],
      ['Concepto', 'Monto'],
      ['Ventas Brutas', pnl.grossSales],
      ['Costo de Ventas (COGS)', -pnl.totalCOGS],
      ['UTILIDAD BRUTA', pnl.grossProfit],
      ['Gastos Operativos', -pnl.totalOpex],
      ...Object.entries(pnl.opexByCategory).map(([cat, val]) => [`OpEx: ${cat}`, -val]),
      ['Impuestos Estimados', -pnl.estimatedTaxes],
      ['UTILIDAD NETA', pnl.netProfit],
      [],
      ['Valorización de Inventario', report.inventoryValuation],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'P&L');
    XLSX.writeFile(wb, `Reporte_Contable_${dates.start}_${dates.end}.xlsx`);
  };

  return (
    <div className="p-8 md:p-12 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-black rounded-xl text-white">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Reportes Contables</h1>
          </div>
          <p className="text-muted font-medium">Genera estados de resultados oficiales y valuación de activos.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={exportExcel}
             className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
           >
             <FileSpreadsheet className="w-4 h-4" />
             Excel
           </button>
           <button 
             onClick={exportPDF}
             className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all"
           >
             <Download className="w-4 h-4" />
             PDF
           </button>
        </div>
      </div>

      {/* Range Selector */}
      <div className="bg-surface border border-theme rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-2 p-1 bg-base border border-theme rounded-xl w-full md:w-auto">
          {['CURRENT_MONTH', 'LAST_MONTH', 'YEAR_TO_DATE'].map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                range === r ? 'bg-primary text-base-color shadow-sm' : 'text-muted hover:bg-theme/5'
              }`}
            >
              {r === 'CURRENT_MONTH' ? 'Este Mes' : r === 'LAST_MONTH' ? 'Mes Anterior' : 'Año Corrido'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 text-muted">
           <div className="flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             <input 
               type="date" 
               value={dates.start}
               onChange={(e) => setDates({ ...dates, start: e.target.value })}
               className="bg-transparent border-none p-0 text-sm font-bold outline-none text-primary" 
             />
           </div>
           <span className="text-xs font-black">HASTA</span>
           <div className="flex items-center gap-2">
             <Calendar className="w-4 h-4" />
             <input 
               type="date" 
               value={dates.end}
               onChange={(e) => setDates({ ...dates, end: e.target.value })}
               className="bg-transparent border-none p-0 text-sm font-bold outline-none text-primary" 
             />
           </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4">
           <Loader2 className="w-10 h-10 animate-spin text-primary" />
           <p className="text-sm font-bold text-muted animate-pulse">Consolidando transacciones y lotes FIFO...</p>
        </div>
      ) : report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* P&L View */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface border border-theme rounded-3xl overflow-hidden shadow-sm">
              <div className="p-8 border-b border-theme bg-base/30">
                 <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-emerald-500" />
                   Estado de Resultados (P&L)
                 </h2>
              </div>
              <table className="w-full text-left border-collapse">
                <tbody className="divide-y divide-theme">
                  <tr className="bg-base/10">
                    <td className="px-8 py-4 font-bold text-primary">Ingresos Operacionales (Ventas)</td>
                    <td className="px-8 py-4 text-right font-black text-emerald-600">{formatCurrency(report.pnl.grossSales)}</td>
                  </tr>
                  <tr>
                    <td className="px-8 py-4 text-muted font-medium flex items-center gap-2">
                      <ArrowDownRight className="w-4 h-4 text-rose-400" />
                      Costo de Ventas (COGS - FIFO)
                    </td>
                    <td className="px-8 py-4 text-right font-bold text-rose-500">-{formatCurrency(report.pnl.totalCOGS)}</td>
                  </tr>
                  <tr className="bg-primary/5">
                    <td className="px-8 py-4 font-black text-primary text-lg uppercase tracking-tight">Utilidad Bruta</td>
                    <td className="px-8 py-4 text-right font-black text-primary text-lg">{formatCurrency(report.pnl.grossProfit)}</td>
                  </tr>
                  <tr>
                    <td className="px-8 py-4 text-muted font-bold pt-6 pb-2 uppercase text-[10px] tracking-widest">Gastos Operativos (OpEx)</td>
                    <td className="px-8 py-4"></td>
                  </tr>
                  {Object.entries(report.pnl.opexByCategory).map(([cat, val]) => (
                    <tr key={cat}>
                      <td className="px-12 py-3 text-sm text-muted font-medium">{cat}</td>
                      <td className="px-8 py-3 text-right font-bold text-rose-500">-{formatCurrency(val)}</td>
                    </tr>
                  ))}
                  <tr className="bg-rose-50/50">
                    <td className="px-8 py-4 font-bold text-rose-600">Total OpEx</td>
                    <td className="px-8 py-4 text-right font-black text-rose-600">-{formatCurrency(report.pnl.totalOpex)}</td>
                  </tr>
                  <tr>
                    <td className="px-8 py-4 text-muted font-medium italic">Impuestos Estimados (Ej. 19% IVA/Renta)</td>
                    <td className="px-8 py-4 text-right font-bold text-muted">-{formatCurrency(report.pnl.estimatedTaxes)}</td>
                  </tr>
                  <tr className="bg-black text-white">
                    <td className="px-8 py-6 font-black text-xl uppercase tracking-tighter">Utilidad Neta del Periodo</td>
                    <td className="px-8 py-6 text-right font-black text-xl">{formatCurrency(report.pnl.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Side Info */}
          <div className="space-y-8">
             {/* Inventory Valuation */}
             <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm group hover:border-primary/40 transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                    <PieChart className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-primary">Valor del Inventario</h3>
                </div>
                <p className="text-sm text-muted font-medium mb-4">Capital invertido actualmente en bodega (FIFO).</p>
                <div className="text-3xl font-black text-primary">
                  {formatCurrency(report.inventoryValuation)}
                </div>
                <div className="mt-4 pt-4 border-t border-theme flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                  <TrendingUp className="w-3 h-3" />
                  Activo Corriente Disponible
                </div>
             </div>

             {/* Closing Checklist */}
             <div className="bg-surface border border-theme rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
                  <Signature className="w-5 h-5 text-primary" />
                  Cierre Oficial
                </h3>
                <ul className="space-y-4">
                  {[
                    'Transacciones conciliadas',
                    'Lotes FIFO actualizados',
                    'Gastos OpEx registrados',
                    'Impuestos calculados'
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-bold text-muted">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 p-4 bg-base rounded-2xl border border-dashed border-theme">
                  <p className="text-[10px] text-muted font-medium italic text-center">
                    Reporte generado electrónicamente. Los valores están sujetos a auditoría externa.
                  </p>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
