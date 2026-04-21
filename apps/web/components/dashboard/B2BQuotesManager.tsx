'use client';

import { useState, useEffect, useMemo, Fragment, ChangeEvent, useCallback } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import {
  Loader2,
  Briefcase,
  MapPin,
  CheckCircle,
  X,
  Image as ImageIcon,
  QrCode,
  Search,
  ChevronRight,
  ChevronLeft,
  Filter
} from 'lucide-react';
import { ApiResponse } from '@/types/api';
import { cn } from '@/utils/cn';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { ReceiptUpload } from '@/components/dashboard/ReceiptUpload';
import { apiFetch } from '@/utils/api';
import { isDashboardReadOnlyRole } from '@/lib/frontend-routing';

interface B2BQuote {
  id: string;
  businessName: string;
  quantity: number;
  department: string;
  municipality: string;
  neighborhood: string;
  address: string;
  package: 'Empresa' | 'Evento';
  qrType: 'WHATSAPP' | 'WEB' | 'INSTAGRAM';
  qrData?: string;
  status: string;
  logoUrl?: string;
  paymentReceiptUrl?: string | null;
  createdAt: string;
  reservationStatus?: 'NONE' | 'ACTIVE' | 'RELEASED' | 'EXPIRED';
  expiresAt?: string | null;
  items?: B2BQuoteItem[];
}

interface B2BQuoteItem {
  id: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  itemType?: 'STANDARD_STOCK' | 'MANUAL_EXTERNAL_PRODUCTION';
  manualSize?: string | null;
  manualSpecs?: Record<string, unknown> | null;
  externalUnitCost?: number | null;
  agreedUnitPrice?: number | null;
  reservedQuantity?: number;
  reservationExpiresAt?: string | null;
}

interface ProductVariant {
  id: string;
  sku: string;
  size?: string | null;
  color: string;
  stock: number;
  stockCommitted?: number;
  stockAvailable?: number;
  isActive?: boolean;
}

interface ProductOption {
  id: string;
  name: string;
  variants?: ProductVariant[] | null;
}

const INITIAL_MANUAL_QUOTE_FORM = {
  businessName: '',
  contactPhone: '',
  quantity: '50',
  department: '',
  municipality: '',
  neighborhood: '',
  address: '',
  qrData: '',
  productId: '',
  manualSize: '',
  manualSpecs: '',
  externalUnitCost: '',
  agreedUnitPrice: '',
};

export default function B2BQuotesManager() {
  const [quotes, setQuotes] = useState<B2BQuote[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [manualQuoteForm, setManualQuoteForm] = useState(INITIAL_MANUAL_QUOTE_FORM);
  const [manualQuoteSubmitting, setManualQuoteSubmitting] = useState(false);
  const [manualQuoteError, setManualQuoteError] = useState<string | null>(null);
  const [showManualQuoteModal, setShowManualQuoteModal] = useState(false);
  const { role, accessToken } = useDashboardAuth();

  // Filters & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 10;
  const supabase = createClient();

  const isReadOnly = isDashboardReadOnlyRole(role);

  const selectedManualProduct = useMemo(
    () => products.find((product) => product.id === manualQuoteForm.productId),
    [manualQuoteForm.productId, products],
  );

  const loadQuotes = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        setQuotes([]);
        return;
      }

      const res = await apiFetch('/b2b/quotes', {
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });

      if (res.status === 401 || res.status === 403) {
        setLoadError('Tu sesion no tiene permisos suficientes para ver las solicitudes B2B.');
        setQuotes([]);
        return;
      }

      if (!res.ok) {
        const detail = await res.text();
        const nextError = `No fue posible cargar las solicitudes B2B (${res.status}). ${detail}`.trim();
        setLoadError(nextError);
        if (!silent) {
          setQuotes([]);
        }
        return;
      }

      const responseBody: ApiResponse<B2BQuote[]> = await res.json();
      setLoadError(null);
      setQuotes(responseBody.data);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setLoadError('No fue posible conectar con la API de B2B.');
      if (!silent) {
        setQuotes([]);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [accessToken, supabase.auth]);

  const loadProducts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        setProducts([]);
        return;
      }

      const res = await apiFetch('/catalog/admin/products', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        setProducts([]);
        return;
      }

      const responseBody: ApiResponse<ProductOption[]> = await res.json();
      setProducts(responseBody.data ?? []);
    } catch (err) {
      console.error('Error fetching products for manual B2B quote:', err);
      setProducts([]);
    }
  }, [accessToken, supabase.auth]);

  useEffect(() => {
    void loadQuotes();
    void loadProducts();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!(session?.access_token ?? accessToken)) {
          setQuotes([]);
          setLoading(false);
          return;
        }

        void loadQuotes();
        void loadProducts();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [accessToken, loadProducts, loadQuotes, supabase.auth]);

  useEffect(() => {
    const triggerReload = () => {
      if (document.visibilityState === 'visible') {
        void loadQuotes({ silent: true });
      }
    };

    const intervalId = window.setInterval(triggerReload, 300000);
    window.addEventListener('focus', triggerReload);
    document.addEventListener('visibilitychange', triggerReload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', triggerReload);
      document.removeEventListener('visibilitychange', triggerReload);
    };
  }, [loadQuotes]);

  useEffect(() => {
    if (!showManualQuoteModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !manualQuoteSubmitting) {
        setShowManualQuoteModal(false);
        setManualQuoteError(null);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [manualQuoteSubmitting, showManualQuoteModal]);

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        alert('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const res = await apiFetch(`/b2b/quotes/${id}/approve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        }
      });
      if (res.status === 401 || res.status === 403) {
        alert('No tienes permisos para aprobar esta cotización.');
        return;
      }

      if (!res.ok) throw new Error(`Failed to approve (${res.status})`);

      setQuotes(prev => prev.map(q =>
        q.id === id ? { ...q, status: 'DISEÑO_APROBADO' } : q
      ));
    } catch (err) {
      console.error('Error approving quote:', err);
      alert('Error aprobando diseño');
    } finally {
      setProcessingId(null);
    }
  };

  const getPackageColor = (pkg: string) => {
    switch(pkg) {
      case 'Empresa': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'Evento': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default: return 'bg-base dark:bg-zinc-800 text-primary border-theme';
    }
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const searchableFields = [
        quote.businessName,
        quote.package,
        quote.municipality,
        quote.department,
        String(quote.quantity),
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = normalizedSearch.length === 0 || searchableFields.includes(normalizedSearch);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredQuotes.length / ITEMS_PER_PAGE);
    if (nextTotalPages === 0) {
      if (currentPage !== 1) {
        setCurrentPage(1);
      }
      return;
    }

    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, filteredQuotes.length]);

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const handleManualQuoteChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setManualQuoteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateManualQuote = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualQuoteError(null);

    const quantity = Number(manualQuoteForm.quantity);
    const externalUnitCost = Number(manualQuoteForm.externalUnitCost);
    const agreedUnitPrice = Number(manualQuoteForm.agreedUnitPrice);

    if (!manualQuoteForm.productId) {
      setManualQuoteError('Selecciona un producto base.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity < 50) {
      setManualQuoteError('La cantidad minima B2B es 50.');
      return;
    }

    if (
      !Number.isFinite(externalUnitCost) ||
      externalUnitCost < 0 ||
      !Number.isFinite(agreedUnitPrice) ||
      agreedUnitPrice < 0
    ) {
      setManualQuoteError('Costo externo y precio acordado deben ser numeros validos.');
      return;
    }

    setManualQuoteSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        setManualQuoteError('Tu sesion expiro. Inicia sesion de nuevo.');
        return;
      }

      const manualSpecs = manualQuoteForm.manualSpecs.trim()
        ? { notes: manualQuoteForm.manualSpecs.trim() }
        : undefined;

      const res = await apiFetch('/b2b/quotes/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          businessName: manualQuoteForm.businessName,
          contactPhone: manualQuoteForm.contactPhone,
          quantity,
          department: manualQuoteForm.department,
          municipality: manualQuoteForm.municipality,
          neighborhood: manualQuoteForm.neighborhood,
          address: manualQuoteForm.address,
          qrType: 'WHATSAPP',
          qrData: manualQuoteForm.qrData || manualQuoteForm.contactPhone,
          package: quantity >= 100 ? 'Evento' : 'Empresa',
          size: manualQuoteForm.manualSize,
          items: [
            {
              productId: manualQuoteForm.productId,
              quantity,
              itemType: 'MANUAL_EXTERNAL_PRODUCTION',
              manualSize: manualQuoteForm.manualSize,
              manualSpecs,
              externalUnitCost,
              agreedUnitPrice,
              reserveStock: false,
            },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`No fue posible crear la cotizacion manual (${res.status}). ${detail}`);
      }

      setManualQuoteForm(INITIAL_MANUAL_QUOTE_FORM);
      setManualQuoteError(null);
      setShowManualQuoteModal(false);
      await loadQuotes({ silent: true });
    } catch (err) {
      console.error('Error creating manual B2B quote:', err);
      setManualQuoteError(
        err instanceof Error ? err.message : 'No fue posible crear la cotizacion manual.',
      );
    } finally {
      setManualQuoteSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-muted w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      {!isReadOnly ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-theme bg-surface p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary">
              Cotizacion manual
            </h3>
            <p className="max-w-2xl text-xs font-medium text-muted">
              Registra medidas especiales sin crear variantes nuevas en catalogo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setManualQuoteError(null);
              setShowManualQuoteModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 md:self-auto"
          >
            <Briefcase className="h-4 w-4" />
            Crear cotizacion manual
          </button>
        </div>
      ) : null}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-surface p-4 rounded-2xl border border-theme shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por empresa, paquete, ubicacion o cantidad..."
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

      {refreshing ? (
        <p className="text-xs font-black uppercase tracking-widest text-muted">
          Actualizando solicitudes...
        </p>
      ) : null}

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {loadError}
        </div>
      ) : null}

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
                          <div className="py-8 pl-10 grid grid-cols-1 md:grid-cols-4 gap-8 border-t border-theme animate-in slide-in-from-left-2 duration-300">

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

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                <ImageIcon className="w-3.5 h-3.5" /> Comprobante
                              </h4>
                              <ReceiptUpload
                                entityId={quote.id}
                                entityType="b2b"
                                initialUrl={quote.paymentReceiptUrl}
                                disabled={isReadOnly}
                                onUploadSuccess={(url) => {
                                  setQuotes(prev => prev.map(q => 
                                    q.id === quote.id ? { ...q, paymentReceiptUrl: url } : q
                                  ));
                                }}
                              />
                            </div>

                            {quote.items && quote.items.length > 0 ? (
                              <div className="md:col-span-4 space-y-3">
                                <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                                  <Briefcase className="w-3.5 h-3.5" /> Items cotizados
                                </h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                  {quote.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="rounded-2xl border border-theme bg-surface p-4 text-xs shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-black uppercase tracking-widest text-primary">
                                            {item.itemType === 'MANUAL_EXTERNAL_PRODUCTION'
                                              ? 'Produccion externa'
                                              : 'Stock estandar'}
                                          </p>
                                          <p className="mt-1 font-semibold text-muted">
                                            Cantidad: {item.quantity}
                                          </p>
                                        </div>
                                        {item.reservedQuantity ? (
                                          <span className="rounded-md border border-secondary/20 bg-secondary/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-secondary">
                                            Reservado: {item.reservedQuantity}
                                          </span>
                                        ) : null}
                                      </div>
                                      {item.manualSize ? (
                                        <p className="mt-3 font-semibold text-primary">
                                          Medida: {item.manualSize}
                                        </p>
                                      ) : null}
                                      {typeof item.externalUnitCost === 'number' ? (
                                        <p className="mt-2 text-muted">
                                          Costo externo: ${item.externalUnitCost.toLocaleString('es-CO')}
                                        </p>
                                      ) : null}
                                      {typeof item.agreedUnitPrice === 'number' ? (
                                        <p className="mt-1 text-muted">
                                          Precio acordado: ${item.agreedUnitPrice.toLocaleString('es-CO')}
                                        </p>
                                      ) : null}
                                      {item.manualSpecs?.notes ? (
                                        <p className="mt-3 rounded-xl bg-base p-3 font-medium text-muted">
                                          {String(item.manualSpecs.notes)}
                                        </p>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

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

      {showManualQuoteModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => {
            if (!manualQuoteSubmitting) {
              setShowManualQuoteModal(false);
              setManualQuoteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-b2b-quote-title"
            className="w-full max-w-5xl overflow-hidden rounded-3xl border border-theme bg-surface shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleCreateManualQuote}>
              <div className="flex items-start justify-between gap-4 border-b border-theme px-6 py-5 md:px-8">
                <div className="space-y-1">
                  <h3
                    id="manual-b2b-quote-title"
                    className="text-xl font-black tracking-tight text-primary md:text-2xl"
                  >
                    Cotizacion manual
                  </h3>
                  <p className="text-sm font-medium text-muted">
                    Crea una cotizacion B2B con produccion externa y medidas especiales.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!manualQuoteSubmitting) {
                      setShowManualQuoteModal(false);
                      setManualQuoteError(null);
                    }
                  }}
                  disabled={manualQuoteSubmitting}
                  className="rounded-full bg-base/80 p-2 text-muted transition-all hover:bg-base hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Cerrar modal de cotizacion manual"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-6 py-6 md:px-8">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input
                      name="businessName"
                      value={manualQuoteForm.businessName}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Empresa"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="contactPhone"
                      value={manualQuoteForm.contactPhone}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Telefono"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="quantity"
                      type="number"
                      min={50}
                      value={manualQuoteForm.quantity}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Cantidad"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      name="productId"
                      value={manualQuoteForm.productId}
                      onChange={handleManualQuoteChange}
                      required
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Producto base</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="department"
                      value={manualQuoteForm.department}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Departamento"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="municipality"
                      value={manualQuoteForm.municipality}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Municipio"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="neighborhood"
                      value={manualQuoteForm.neighborhood}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Barrio"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="address"
                      value={manualQuoteForm.address}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Direccion"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="manualSize"
                      value={manualQuoteForm.manualSize}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Medida especial"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="externalUnitCost"
                      type="number"
                      min={0}
                      value={manualQuoteForm.externalUnitCost}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Costo externo unitario"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="agreedUnitPrice"
                      type="number"
                      min={0}
                      value={manualQuoteForm.agreedUnitPrice}
                      onChange={handleManualQuoteChange}
                      required
                      placeholder="Precio acordado unitario"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="qrData"
                      value={manualQuoteForm.qrData}
                      onChange={handleManualQuoteChange}
                      placeholder="WhatsApp o QR"
                      className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <textarea
                    name="manualSpecs"
                    value={manualQuoteForm.manualSpecs}
                    onChange={handleManualQuoteChange}
                    placeholder="Especificaciones de produccion externa"
                    rows={4}
                    className="w-full rounded-xl border border-theme bg-surface px-3 py-2.5 text-sm text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />

                  {selectedManualProduct ? (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                      Producto base: {selectedManualProduct.name}. No se creara una variante
                      permanente.
                    </p>
                  ) : null}

                  {manualQuoteError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                      {manualQuoteError}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-theme px-6 py-4 md:flex-row md:items-center md:justify-end md:px-8">
                <button
                  type="button"
                  onClick={() => {
                    if (!manualQuoteSubmitting) {
                      setShowManualQuoteModal(false);
                      setManualQuoteError(null);
                    }
                  }}
                  disabled={manualQuoteSubmitting}
                  className="inline-flex items-center justify-center rounded-xl border border-theme px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-base disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualQuoteSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {manualQuoteSubmitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Briefcase className="h-4 w-4" />
                  )}
                  Crear cotizacion manual
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
