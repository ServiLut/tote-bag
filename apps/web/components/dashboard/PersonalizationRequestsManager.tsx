'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo, Fragment, ChangeEvent, useCallback } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import {
  Loader2,
  Sparkles,
  Search,
  ChevronRight,
  ChevronLeft,
  Filter,
  Image as ImageIcon,
  FileText,
  CheckCircle,
  Clock3,
  Tag,
  MapPin,
  Palette,
  ArrowRight,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@tote-bag/ui';
import { ApiResponse } from '@/types/api';
import { cn } from '@/utils/cn';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { apiFetch } from '@/utils/api';
import { isDashboardReadOnlyRole } from '@/lib/frontend-routing';

type RequestStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'READY_TO_CLOSE' | string;

interface PersonalizationRequest {
  id: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt?: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productName?: string | null;
  productSlug?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  designUrl?: string | null;
  notes?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  profileId?: string | null;
  configuration?: {
    line?: string | null;
    size?: string | null;
    material?: string | null;
    quality?: string | null;
    configCode?: string | null;
  } | null;
}

type NormalizedPersonalizationRequest = PersonalizationRequest & {
  searchIndex: string;
};

const REQUEST_ENDPOINTS = ['/personalizations/requests', '/personalization-requests'];
const REQUEST_MUTATION_ENDPOINTS = [
  (id: string) => `/personalizations/requests/${id}`,
  (id: string) => `/personalization-requests/${id}`,
];
const APPROVE_ENDPOINTS = [
  (id: string) => `/personalizations/requests/${id}/approve`,
  (id: string) => `/personalizations/${id}/approve`,
  (id: string) => `/personalization-requests/${id}/approve`,
];

function asString(value: unknown) {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeRequest(value: unknown): NormalizedPersonalizationRequest | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const customer =
    input.customer && typeof input.customer === 'object'
      ? (input.customer as Record<string, unknown>)
      : null;
  const profile =
    input.profile && typeof input.profile === 'object'
      ? (input.profile as Record<string, unknown>)
      : null;
  const user =
    input.user && typeof input.user === 'object'
      ? (input.user as Record<string, unknown>)
      : null;
  const product =
    input.product && typeof input.product === 'object'
      ? (input.product as Record<string, unknown>)
      : null;
  const configuration =
    input.configuration && typeof input.configuration === 'object'
      ? (input.configuration as Record<string, unknown>)
      : input.configurationJson && typeof input.configurationJson === 'object'
        ? (input.configurationJson as Record<string, unknown>)
        : null;

  const customerName =
    asString(input.customerName) ||
    asString(input.fullName) ||
    `${asString(customer?.firstName)} ${asString(customer?.lastName)}`.trim() ||
    `${asString(profile?.firstName)} ${asString(profile?.lastName)}`.trim() ||
    asString(customer?.name) ||
    asString(profile?.email) ||
    asString(user?.email) ||
    asString(input.email) ||
    'Cliente sin nombre';

  const normalized: NormalizedPersonalizationRequest = {
    id: asString(input.id),
    status: asString(input.status) || 'PENDING',
    createdAt: asString(input.createdAt),
    updatedAt: asString(input.updatedAt) || undefined,
    customerName,
    customerEmail:
      asString(input.customerEmail) ||
      asString(customer?.email) ||
      asString(profile?.email) ||
      asString(user?.email) ||
      null,
    customerPhone:
      asString(input.customerPhone) ||
      asString(customer?.phone) ||
      asString(profile?.phone) ||
      null,
    productName: asString(input.productName) || asString(product?.name) || null,
    productSlug: asString(input.productSlug) || asString(product?.slug) || null,
    quantity: asNumber(input.quantity),
    unitPrice: asNumber(input.unitPrice),
    totalPrice: asNumber(input.totalPrice),
    designUrl: asString(input.designUrl) || null,
    notes: asString(input.notes) || null,
    reviewedAt: asString(input.reviewedAt) || null,
    reviewedBy:
      asString(input.reviewedBy) ||
      asString(input.reviewedByUserId) ||
      null,
    profileId: asString(input.profileId) || asString(profile?.id) || null,
    configuration: configuration
      ? {
          line: asString(configuration.line) || null,
          size: asString(configuration.size) || null,
          material: asString(configuration.material) || null,
          quality: asString(configuration.quality) || null,
          configCode: asString(configuration.configCode) || null,
        }
      : null,
    searchIndex: [
      customerName,
      asString(input.customerEmail),
      asString(input.customerPhone),
      asString(profile?.email),
      asString(profile?.phone),
      asString(input.productName),
      asString(product?.name),
      asString(input.productSlug),
      asString(product?.slug),
      asString(input.status),
      asString(input.quantity),
      asString(configuration?.line),
      asString(configuration?.size),
      asString(configuration?.material),
      asString(configuration?.configCode),
    ]
      .join(' ')
      .toLowerCase(),
  };

  return normalized.id ? normalized : null;
}

function formatCurrency(amount: number | null | undefined) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return 'N/D';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | undefined) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha inválida';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(date);
}

function getStatusLabel(status: RequestStatus) {
  const normalized = status.toUpperCase();
  if (normalized.includes('APPROVED') || normalized.includes('APROB')) return 'Aprobada';
  if (normalized.includes('REJECT')) return 'Rechazada';
  if (normalized.includes('READY') || normalized.includes('LISTO')) return 'Lista para finalizar';
  if (normalized.includes('UNDER')) return 'En revisión';
  if (normalized.includes('REVIEW')) return 'En revision';
  return 'Pendiente';
}

function getStatusTone(status: RequestStatus) {
  const normalized = status.toUpperCase();
  if (normalized.includes('APPROVED') || normalized.includes('APROB')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';
  }
  if (normalized.includes('REJECT')) {
    return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900';
  }
  if (normalized.includes('READY') || normalized.includes('LISTO')) {
    return 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900';
  }
  if (normalized.includes('REVIEW')) {
    return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900';
  }
  return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';
}

export default function PersonalizationRequestsManager() {
  const [requests, setRequests] = useState<NormalizedPersonalizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [receiptFiles, setReceiptFiles] = useState<Record<string, File | undefined>>({});
  const { role, accessToken } = useDashboardAuth();
  const supabase = createClient();
  const isReadOnly = isDashboardReadOnlyRole(role);
  const ITEMS_PER_PAGE = 8;

  const loadRequests = useCallback(async (options?: { silent?: boolean }) => {
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
        setRequests([]);
        return;
      }

      let response: Response | null = null;
      for (const endpoint of REQUEST_ENDPOINTS) {
        response = await apiFetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status !== 404) break;
      }

      if (!response) {
        setLoadError('No fue posible conectar con el módulo de personalizaciones.');
        setRequests([]);
        return;
      }

      if (response.status === 401 || response.status === 403) {
        setLoadError('Tu sesión no tiene permisos suficientes para ver las solicitudes de personalización.');
        setRequests([]);
        return;
      }

      if (!response.ok) {
        const detail = await response.text();
        setLoadError(`No fue posible cargar las solicitudes de personalización (${response.status}). ${detail}`.trim());
        if (!silent) setRequests([]);
        return;
      }

      const body: ApiResponse<unknown> | unknown = await response.json();
      const payload = body && typeof body === 'object' && 'data' in body
        ? (body as ApiResponse<unknown>).data
        : body;
      const items = Array.isArray(payload) ? payload : [];

      setRequests(items.map(normalizeRequest).filter(Boolean) as NormalizedPersonalizationRequest[]);
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching personalization requests:', error);
      setLoadError('No fue posible conectar con la API de personalizaciones.');
      if (!silent) setRequests([]);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [accessToken, supabase.auth]);

  useEffect(() => {
    void loadRequests();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!(session?.access_token ?? accessToken)) {
          setRequests([]);
          setLoading(false);
          return;
        }
        void loadRequests();
      },
    );

    return () => subscription.unsubscribe();
  }, [accessToken, loadRequests, supabase.auth]);

  useEffect(() => {
    const triggerReload = () => {
      if (document.visibilityState === 'visible') {
        void loadRequests({ silent: true });
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
  }, [loadRequests]);

  const handleApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveActionMenu(null);
    setProcessingId(id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        alert('Tu sesión expiró. Inicia sesión de nuevo.');
        return;
      }

      const selectedReceipt = receiptFiles[id];
      if (!selectedReceipt) {
        alert('Adjunta un comprobante antes de aprobar la solicitud.');
        return;
      }

      const formData = new FormData();
      formData.append('file', selectedReceipt);

      let response: Response | null = null;
      for (const buildEndpoint of APPROVE_ENDPOINTS) {
        response = await apiFetch(buildEndpoint(id), {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (response.status !== 404) break;
      }

      if (!response) {
        throw new Error('No se pudo resolver el endpoint de aprobación.');
      }

      if (response.status === 401 || response.status === 403) {
        alert('No tienes permisos para aprobar esta solicitud.');
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          errorBody && typeof errorBody === 'object'
            ? ('message' in errorBody
                ? Array.isArray(errorBody.message)
                  ? errorBody.message.join(', ')
                  : String(errorBody.message)
                : 'error' in errorBody
                  ? String(errorBody.error)
                  : null)
            : null;
        throw new Error(errorMessage || `Failed to approve (${response.status})`);
      }

      setRequests((prev) =>
        prev.map((request) =>
          request.id === id
            ? { ...request, status: 'READY_TO_CLOSE', reviewedAt: new Date().toISOString() }
            : request,
        ),
      );
      setReceiptFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error('Error approving personalization request:', error);
      alert(error instanceof Error ? error.message : 'Error aprobando la solicitud');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesSearch =
        searchTerm.trim().length === 0 || request.searchIndex.includes(searchTerm.trim().toLowerCase());
      const normalizedStatus = request.status.toUpperCase();
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
            ? !normalizedStatus.includes('APPROVED') && !normalizedStatus.includes('REJECT')
            : statusFilter === 'APPROVED'
              ? normalizedStatus.includes('APPROVED') || normalizedStatus.includes('READY') || normalizedStatus.includes('APROB')
              : normalizedStatus.includes('REJECT');
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const nextTotalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
    if (nextTotalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, filteredRequests.length]);

  const toggleRow = (id: string) => {
    setExpandedRowId((current) => (current === id ? null : id));
  };

  const handleReceiptChange = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReceiptFiles((prev) => ({
      ...prev,
      [id]: file,
    }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isReadOnly) {
      return;
    }

    const confirmed = window.confirm(
      'Esta solicitud se eliminara permanentemente. Esta accion no se puede deshacer.',
    );

    if (!confirmed) {
      return;
    }

    setActiveActionMenu(null);
    setDeletingId(id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;
      if (!token) {
        alert('Tu sesiÃ³n expirÃ³. Inicia sesiÃ³n de nuevo.');
        return;
      }

      let response: Response | null = null;
      for (const buildEndpoint of REQUEST_MUTATION_ENDPOINTS) {
        response = await apiFetch(buildEndpoint(id), {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status !== 404) break;
      }

      if (!response) {
        throw new Error('No se pudo resolver el endpoint de eliminaciÃ³n.');
      }

      if (response.status === 401 || response.status === 403) {
        alert('No tienes permisos para eliminar esta solicitud.');
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          errorBody && typeof errorBody === 'object'
            ? ('message' in errorBody
                ? Array.isArray(errorBody.message)
                  ? errorBody.message.join(', ')
                  : String(errorBody.message)
                : 'error' in errorBody
                  ? String(errorBody.error)
                  : null)
            : null;
        throw new Error(errorMessage || `Failed to delete (${response.status})`);
      }

      setRequests((prev) => prev.filter((request) => request.id !== id));
      setExpandedRowId((current) => (current === id ? null : current));
      setReceiptFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error('Error deleting personalization request:', error);
      alert(error instanceof Error ? error.message : 'Error eliminando la solicitud');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted" /></div>;
  }

  return (
    <div className="space-y-6">
      {!isReadOnly ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-theme bg-surface p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-primary">
              Solicitud manual
            </h3>
            <p className="max-w-2xl text-xs font-medium text-muted">
              Registra una personalizacion desde el dashboard para un cliente existente.
            </p>
          </div>
          <Link
            href="/dashboard/personalizaciones/nueva"
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-base-color shadow-lg shadow-primary/10 transition-all active:scale-95 md:self-auto"
          >
            <Sparkles className="h-4 w-4" />
            Crear solicitud manual
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 rounded-2xl border border-theme bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Buscar por cliente, producto o código..."
            className="w-full rounded-xl border border-theme bg-surface py-2.5 pl-10 pr-4 text-sm font-medium text-primary placeholder:text-muted/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative w-full sm:w-56">
          <select
            className="w-full appearance-none rounded-xl border border-theme bg-surface py-2.5 pl-4 pr-10 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={statusFilter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')}
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
          </select>
          <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </div>

      {refreshing ? <p className="text-xs font-black uppercase tracking-widest text-muted">Actualizando solicitudes...</p> : null}

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {loadError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-theme bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-theme bg-base/50 text-primary">
              <tr>
                <th className="w-10 px-6 py-4"></th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Solicitud</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Cant.</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Estado</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center font-medium text-muted">
                    No se encontraron solicitudes de personalización
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((request) => {
                  const isApproved = request.status.toUpperCase().includes('APPROVED') || request.status.toUpperCase().includes('READY');
                  const canEditOrDelete = !isApproved && !isReadOnly;
                  const isDeleting = deletingId === request.id;
                  const isApproving = processingId === request.id;
                  return (
                    <Fragment key={request.id}>
                      <tr
                        className={cn('cursor-pointer transition-colors hover:bg-base/30', expandedRowId === request.id && 'bg-base/30')}
                        onClick={() => toggleRow(request.id)}
                      >
                        <td className="px-6 py-4">
                          <ChevronRight className={cn('h-4 w-4 text-muted transition-transform duration-200', expandedRowId === request.id && 'rotate-90 text-primary')} />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold tracking-tight text-primary">{request.customerName}</span>
                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted">{request.customerEmail || 'Sin correo'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">{request.productName || 'Solicitud técnica'}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted">{request.configuration?.configCode || request.productSlug || 'Sin código'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-theme bg-base text-xs font-black text-primary shadow-sm">
                            {request.quantity ?? 'N/D'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest', getStatusTone(request.status))}>
                            {isApproved ? <CheckCircle className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                            {getStatusLabel(request.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isApproved ? (
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex justify-end">
                                <Popover
                                  open={activeActionMenu === request.id}
                                  onOpenChange={(open) =>
                                    setActiveActionMenu(open ? request.id : null)
                                  }
                                >
                                  <PopoverTrigger>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary transition-colors hover:bg-primary/5"
                                      aria-label={`Acciones para solicitud ${request.configuration?.configCode || request.id.slice(0, 8)}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="bottom"
                                    align="end"
                                    className="w-56 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                                  >
                                    <button
                                      type="button"
                                      disabled
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary opacity-50"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      disabled
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 opacity-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Eliminar
                                    </button>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                <CheckCircle className="h-4 w-4" />
                                Pedido creado
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex justify-end">
                                <Popover
                                  open={activeActionMenu === request.id}
                                  onOpenChange={(open) =>
                                    setActiveActionMenu(open ? request.id : null)
                                  }
                                >
                                  <PopoverTrigger>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary transition-colors hover:bg-primary/5"
                                      aria-label={`Acciones para solicitud ${request.configuration?.configCode || request.id.slice(0, 8)}`}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    side="bottom"
                                    align="end"
                                    className="w-56 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                                  >
                                    <Link
                                      href={`/dashboard/personalizaciones/nueva?editar=${request.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveActionMenu(null);
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => void handleDelete(request.id, e)}
                                      disabled={!canEditOrDelete || isDeleting || !!processingId}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                      Eliminar
                                    </button>
                                    <label
                                      htmlFor={`receipt-${request.id}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className={cn(
                                        'flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5',
                                        (!!processingId || isReadOnly || isDeleting) && 'cursor-not-allowed opacity-50',
                                      )}
                                    >
                                      <FileText className="h-4 w-4" />
                                      {receiptFiles[request.id] ? 'Cambiar comprobante' : 'Agregar comprobante'}
                                    </label>
                                    <button
                                      type="button"
                                      onClick={(e) => handleApprove(request.id, e)}
                                      disabled={!!processingId || isReadOnly || !receiptFiles[request.id] || isDeleting}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isApproving ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-4 w-4" />
                                      )}
                                      {isReadOnly ? 'Solo lectura' : 'Aprobar revisión'}
                                    </button>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <input
                                id={`receipt-${request.id}`}
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleReceiptChange(request.id, e)}
                                disabled={!!processingId || isReadOnly || isDeleting}
                              />
                              {receiptFiles[request.id] ? (
                                <span className="max-w-[220px] truncate text-[10px] font-bold text-muted" title={receiptFiles[request.id]?.name}>
                                  {receiptFiles[request.id]?.name}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>

                      {expandedRowId === request.id ? (
                        <tr className="bg-base/10">
                          <td colSpan={6} className="px-6 py-0">
                            <div className="grid gap-6 border-t border-theme py-8 pl-10 md:grid-cols-4">
                              <div className="space-y-3">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                                  <Tag className="h-3.5 w-3.5" /> Configuración
                                </h4>
                                <div className="space-y-2 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
                                  <p className="text-sm font-bold text-primary">{request.productName || 'Sin producto'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Línea: {request.configuration?.line || 'N/D'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Tamaño: {request.configuration?.size || 'N/D'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Material: {request.configuration?.material || 'N/D'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Calidad: {request.configuration?.quality || 'N/D'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Código: {request.configuration?.configCode || 'N/D'}</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                                  <MapPin className="h-3.5 w-3.5" /> Cliente
                                </h4>
                                <div className="space-y-2 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
                                  <p className="text-sm font-bold text-primary">{request.customerName}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">{request.customerEmail || 'Sin correo'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">{request.customerPhone || 'Sin teléfono'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Perfil: {request.profileId || 'N/D'}</p>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                                  <Palette className="h-3.5 w-3.5" /> Diseño
                                </h4>
                                <div className="space-y-3 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
                                  <div className="flex items-center gap-4">
                                    <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-theme bg-base shadow-inner">
                                      {request.designUrl ? (
                                        <Image src={request.designUrl} alt="Diseño personalizado" width={64} height={64} className="h-full w-full object-contain p-2" unoptimized />
                                      ) : (
                                        <ImageIcon className="h-8 w-8 text-muted opacity-30" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-black uppercase tracking-tight text-primary">Archivo cargado</p>
                                      <p className="text-[10px] font-bold text-muted">{request.designUrl ? 'Listo para revisión' : 'Sin archivo adjunto'}</p>
                                    </div>
                                  </div>
                                  {request.designUrl ? (
                                    <a href={request.designUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-secondary hover:underline">
                                      Ver diseño
                                      <ArrowRight className="h-3 w-3" />
                                    </a>
                                  ) : null}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                                  <FileText className="h-3.5 w-3.5" /> Resumen
                                </h4>
                                <div className="space-y-2 rounded-2xl border border-theme bg-surface p-4 shadow-sm">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Cantidad: {request.quantity ?? 'N/D'}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Unitario: {formatCurrency(request.unitPrice)}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Total: {formatCurrency(request.totalPrice)}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Solicitado: {formatDate(request.createdAt)}</p>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted">Estado: {getStatusLabel(request.status)}</p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-theme bg-base/50 px-6 py-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-muted">
            Mostrando <span className="text-primary">{paginatedRequests.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span> de <span className="text-primary">{filteredRequests.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-xl border border-theme bg-surface p-2 text-muted shadow-sm transition-all active:scale-90 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded-xl border border-theme bg-surface p-2 text-muted shadow-sm transition-all active:scale-90 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
