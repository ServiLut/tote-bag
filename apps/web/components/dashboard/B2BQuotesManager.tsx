'use client';

import { useState, useEffect, useMemo, Fragment, ChangeEvent } from 'react';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { 
  Loader2, 
  Briefcase, 
  MapPin, 
  CheckCircle, 
  Image as ImageIcon, 
  QrCode, 
  Search, 
  ChevronRight, 
  ChevronLeft,
  Filter
} from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { cn } from '@/utils/cn';

interface B2BQuote {
  id: string;
  businessName: string;
  quantity: number;
  department: string;
  municipality: string;
  neighborhood: string;
  address: string;
  package: 'Starter' | 'Pro' | 'Evento';
  qrType: 'WHATSAPP' | 'WEB' | 'INSTAGRAM';
  qrData?: string;
  status: string;
  logoUrl?: string;
  createdAt: string;
}

export default function B2BQuotesManager() {
  const [quotes, setQuotes] = useState<B2BQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  
  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  const ITEMS_PER_PAGE = 10;
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const supabase = createClient();

  useEffect(() => {
    const userRole = localStorage.getItem('user_role');
    setRole(userRole);
  }, []);

  const isReadOnly = role === 'ADVISOR';

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_URL}/b2b/quotes`, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          }
        });
        if (!res.ok) throw new Error('Failed to fetch quotes');
        const responseBody: ApiResponse<B2BQuote[]> = await res.json();
        setQuotes(responseBody.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, [API_URL, supabase.auth]);

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/b2b/quotes/${id}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });
      if (!res.ok) throw new Error('Failed to approve');
      
      setQuotes(prev => prev.map(q => 
        q.id === id ? { ...q, status: 'DISEÑO_APROBADO' } : q
      ));
    } catch {
      alert('Error aprobando diseño');
    } finally {
      setProcessingId(null);
    }
  };

  const getPackageColor = (pkg: string) => {
    switch(pkg) {
      case 'Starter': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'Pro': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'Evento': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default: return 'bg-base dark:bg-zinc-800 text-primary border-theme';
    }
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const matchesSearch = quote.businessName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' 
        ? true 
        : statusFilter === 'APPROVED' 
          ? quote.status === 'DISEÑO_APROBADO'
          : quote.status !== 'DISEÑO_APROBADO';
      
      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-muted w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-surface p-4 rounded-2xl border border-theme shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input 
            type="text" 
            placeholder="Buscar por empresa..." 
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-theme rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface text-primary placeholder:text-muted/50 font-medium transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <select 
              className="w-full sm:w-48 pl-4 pr-10 py-2.5 text-sm font-bold border border-theme rounded-xl appearance-none bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer text-primary"
              value={statusFilter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED')}
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDING">Pendientes</option>
              <option value="APPROVED">Aprobados</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-surface rounded-2xl border border-theme shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-base/50 border-b border-theme text-primary">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Empresa</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Paquete</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Ubicación</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-center">Cant.</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Estado</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {paginatedQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted font-medium bg-surface">
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((quote) => (
                  <Fragment key={quote.id}>
                    <tr 
                      className={cn(
                        "hover:bg-base/30 transition-colors cursor-pointer group",
                        expandedRowId === quote.id && "bg-base/30"
                      )}
                      onClick={() => toggleRow(quote.id)}
                    >
                      <td className="px-6 py-4">
                        <ChevronRight className={cn(
                          "w-4 h-4 text-muted transition-transform duration-200",
                          expandedRowId === quote.id && "rotate-90 text-primary"
                        )} />
                      </td>
                      <td className="px-6 py-4 font-bold text-primary tracking-tight">
                        {quote.businessName}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border", getPackageColor(quote.package))}>
                          {quote.package}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-primary font-bold text-xs uppercase tracking-tight">{quote.municipality}</span>
                          <span className="text-[10px] text-muted font-medium uppercase tracking-tighter opacity-70">{quote.department}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-base border border-theme text-primary font-black text-xs shadow-sm">
                          {quote.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {quote.status === 'DISEÑO_APROBADO' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-secondary/10 text-secondary border border-secondary/20">
                            <CheckCircle className="w-3 h-3" />
                            Aprobado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {quote.status === 'DISEÑO_APROBADO' ? (
                          <button
                            disabled
                            className="inline-flex items-center gap-2 px-4 py-2 bg-base text-muted rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-theme shadow-inner opacity-60"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Aprobado
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleApprove(quote.id, e)}
                            disabled={!!processingId || isReadOnly}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-base-color rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingId === quote.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Briefcase className="w-4 h-4" />
                            )}
                            {isReadOnly ? 'Solo Lectura' : 'Aprobar'}
                          </button>
                        )}
                      </td>
                    </tr>
                    
                    {/* Expanded Detail Row */}
                    {expandedRowId === quote.id && (
                      <tr className="bg-base/10">
                        <td colSpan={7} className="px-6 py-0">
                          <div className="py-8 pl-10 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-theme animate-in slide-in-from-left-2 duration-300">
                            
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5" /> Entrega
                              </h4>
                              <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm space-y-1">
                                <p className="text-sm font-bold text-primary">{quote.address}</p>
                                <p className="text-muted text-[10px] font-black uppercase tracking-widest">{quote.neighborhood}</p>
                                <p className="text-muted text-[10px] font-black uppercase tracking-widest opacity-60">{quote.municipality}, {quote.department}</p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <QrCode className="w-3.5 h-3.5" /> Configuración QR
                              </h4>
                              <div className="p-4 bg-surface rounded-2xl border border-theme shadow-sm space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase text-muted">Tipo:</span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary text-base-color rounded text-[10px] font-black uppercase tracking-widest">
                                    {quote.qrType}
                                  </span>
                                </div>
                                {quote.qrData && (
                                  <div className="p-3 bg-base border border-theme rounded-xl text-[10px] font-mono text-muted break-all shadow-inner leading-relaxed">
                                    {quote.qrData}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5" /> Arte & Logo
                              </h4>
                              <div className="flex items-center gap-4 p-4 bg-surface rounded-2xl border border-theme shadow-sm">
                                <div className="w-16 h-16 bg-base rounded-xl border border-theme flex items-center justify-center overflow-hidden relative shadow-inner">
                                  {quote.logoUrl ? (
                                    <Image 
                                      src={quote.logoUrl} 
                                      alt="Logo" 
                                      width={64}
                                      height={64}
                                      className="w-full h-full object-contain p-2"
                                      unoptimized
                                    />
                                  ) : (
                                    <ImageIcon className="w-8 h-8 text-muted opacity-30" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-primary uppercase tracking-tight truncate">Logo Corporativo</p>
                                  <p className="text-[10px] text-muted font-bold mb-2">
                                    {quote.logoUrl ? 'Listo para descarga' : 'Sin archivo'}
                                  </p>
                                  {quote.logoUrl && (
                                    <a 
                                      href={quote.logoUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-secondary hover:underline underline-offset-4"
                                    >
                                      Descargar Arte
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-theme bg-base/50">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted">
            Mostrando <span className="text-primary">{paginatedQuotes.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> de <span className="text-primary">{filteredQuotes.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-theme bg-surface text-muted hover:text-primary disabled:opacity-30 transition-all active:scale-90 shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-2 rounded-xl border border-theme bg-surface text-muted hover:text-primary disabled:opacity-30 transition-all active:scale-90 shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
