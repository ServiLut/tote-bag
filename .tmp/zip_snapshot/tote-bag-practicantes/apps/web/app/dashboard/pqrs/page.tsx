'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Inbox, Loader2, MessageSquareReply, Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

type PqrsStatus = 'NUEVO' | 'EN_REVISION' | 'RESPONDIDO' | 'CERRADO';

type PqrsTicket = {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  type: 'PETICION' | 'QUEJA' | 'RECLAMO' | 'SUGERENCIA';
  subject: string;
  message: string;
  orderNumber?: string | null;
  status: PqrsStatus;
  adminResponse?: string | null;
  createdAt: string;
};

const STATUS_OPTIONS: Array<{ value: 'ALL' | PqrsStatus; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'NUEVO', label: 'Nuevas' },
  { value: 'EN_REVISION', label: 'En revision' },
  { value: 'RESPONDIDO', label: 'Respondidas' },
  { value: 'CERRADO', label: 'Cerradas' },
];

export default function DashboardPqrsPage() {
  const supabase = createClient();
  const [tickets, setTickets] = useState<PqrsTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | PqrsStatus>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftStatus, setDraftStatus] = useState<PqrsStatus>('NUEVO');
  const [draftResponse, setDraftResponse] = useState('');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const lastHydratedTicketRef = useRef<string | null>(null);
  const draftDirtyRef = useRef(false);

  const normalizeTickets = useCallback((payload: unknown): PqrsTicket[] => {
    if (Array.isArray(payload)) {
      return payload as PqrsTicket[];
    }

    if (
      payload &&
      typeof payload === 'object' &&
      'data' in payload &&
      Array.isArray((payload as { data?: unknown }).data)
    ) {
      return (payload as { data: PqrsTicket[] }).data;
    }

    return [];
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadTickets = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const headers = await getAuthHeaders();
      const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const response = await apiFetch(`/pqrs${query}`, { headers });
      
      if (!response.ok) {
        const detail = await response.text();
        const nextError =
          response.status === 401 || response.status === 403
            ? 'Tu sesion no tiene permisos suficientes para ver la bandeja PQRS.'
            : `No fue posible cargar la bandeja PQRS (${response.status}). ${detail}`.trim();
        setLoadError(nextError);
        if (!silent) {
          setTickets([]);
          setSelectedId(null);
        }
        return;
      }

      const body = await response.json();
      const nextTickets = normalizeTickets(body);
      setLoadError(null);
      setTickets(nextTickets);

      const fallbackSelectedId =
        nextTickets.find((ticket: PqrsTicket) => ticket.id === selectedIdRef.current)?.id ||
        nextTickets[0]?.id ||
        null;
      setSelectedId(fallbackSelectedId);
    } catch (error) {
      console.error('Error loading pqrs inbox:', error);
      setLoadError('No fue posible conectar con la API de PQRS.');
      if (!silent) {
        setTickets([]);
        setSelectedId(null);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [normalizeTickets, statusFilter]);

  useEffect(() => {
    void loadTickets();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token) {
          setTickets([]);
          setSelectedId(null);
          setLoading(false);
          return;
        }

        void loadTickets();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadTickets, supabase.auth]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadTickets({ silent: true });
      }
    }, 15000);

    const handleWindowFocus = () => {
      void loadTickets({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadTickets({ silent: true });
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return tickets;
    }

    return tickets.filter((ticket) =>
      [ticket.fullName, ticket.email, ticket.subject, ticket.type, ticket.orderNumber || '']
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [search, tickets]);

  const selectedTicket =
    filteredTickets.find((ticket) => ticket.id === selectedId) ||
    tickets.find((ticket) => ticket.id === selectedId) ||
    null;

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }

    if (draftDirtyRef.current && lastHydratedTicketRef.current === selectedTicket.id) {
      return;
    }

    setDraftStatus(selectedTicket.status);
    setDraftResponse(selectedTicket.adminResponse || '');
    lastHydratedTicketRef.current = selectedTicket.id;
    draftDirtyRef.current = false;
  }, [selectedTicket]);

  const inboxStats = useMemo(() => {
    return {
      total: tickets.length,
      nuevos: tickets.filter((ticket) => ticket.status === 'NUEVO').length,
      pendientes: tickets.filter((ticket) => ticket.status === 'EN_REVISION').length,
    };
  }, [tickets]);

  const handleSave = async () => {
    if (!selectedTicket) {
      return;
    }

    setSaving(true);
    setSaveNotice(null);
    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch(`/pqrs/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          status: draftStatus,
          adminResponse: draftResponse || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('No fue posible actualizar la PQRS.');
      }

      draftDirtyRef.current = false;
      lastHydratedTicketRef.current = selectedTicket.id;
      setSaveNotice('PQRS actualizada correctamente.');
      await loadTickets({ silent: true });
    } catch (error) {
      console.error(error);
      setSaveNotice('No fue posible actualizar la PQRS.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted">Cargando bandeja de PQRS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-primary">
            <Inbox className="h-8 w-8" />
            Bandeja PQRS
          </h1>
          <p className="font-medium text-muted">
            Peticiones, quejas, reclamos y sugerencias enviadas desde la tienda.
          </p>
          {refreshing ? (
            <p className="text-xs font-black uppercase tracking-widest text-muted">
              Actualizando bandeja...
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatPill label="Total" value={String(inboxStats.total)} />
          <StatPill label="Nuevas" value={String(inboxStats.nuevos)} />
          <StatPill label="En revision" value={String(inboxStats.pendientes)} />
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
          {loadError}
        </div>
      ) : null}

      {saveNotice ? (
        <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${saveNotice.includes('correctamente') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
          {saveNotice}
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-3xl border border-theme bg-surface shadow-sm">
          <div className="border-b border-theme bg-base/30 p-6">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por cliente, asunto o pedido..."
                  className="w-full rounded-xl border border-theme bg-base py-3 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStatusFilter(option.value)}
                    className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === option.value
                        ? 'bg-primary text-base-color'
                        : 'border border-theme bg-surface text-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[720px] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm italic text-muted">
                No hay PQRS que coincidan con el filtro actual.
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full border-b border-theme px-6 py-5 text-left transition-colors hover:bg-primary/5 ${
                    selectedTicket?.id === ticket.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-primary">{ticket.subject}</p>
                      <p className="mt-1 text-xs font-medium text-muted">
                        {ticket.fullName} · {ticket.email}
                      </p>
                    </div>
                    <TicketBadge value={ticket.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted">
                    <span>{ticket.type}</span>
                    <span>·</span>
                    <span>{new Date(ticket.createdAt).toLocaleDateString('es-CO')}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
          {selectedTicket ? (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <TicketBadge value={selectedTicket.status} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                      {selectedTicket.type}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-primary">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-2 text-sm font-medium text-muted">
                    {selectedTicket.fullName} · {selectedTicket.email}
                    {selectedTicket.phone ? ` · ${selectedTicket.phone}` : ''}
                  </p>
                  {selectedTicket.orderNumber ? (
                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-muted">
                      Pedido relacionado: {selectedTicket.orderNumber}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-muted">
                  {new Date(selectedTicket.createdAt).toLocaleString('es-CO')}
                </span>
              </div>

              <div className="rounded-2xl border border-theme bg-base/30 p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Mensaje del cliente
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-7 text-primary">
                  {selectedTicket.message}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.42fr_0.58fr]">
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Estado
                  </span>
                  <select
                    value={draftStatus}
                    onChange={(event) => {
                      draftDirtyRef.current = true;
                      setSaveNotice(null);
                      setDraftStatus(event.target.value as PqrsStatus);
                    }}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {STATUS_OPTIONS.filter((option) => option.value !== 'ALL').map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Respuesta interna / seguimiento
                  </span>
                  <textarea
                    rows={6}
                    value={draftResponse}
                    onChange={(event) => {
                      draftDirtyRef.current = true;
                      setSaveNotice(null);
                      setDraftResponse(event.target.value);
                    }}
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-black uppercase tracking-wider text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <MessageSquareReply className="h-5 w-5" />
                )}
                {saving ? 'Guardando...' : 'Actualizar PQRS'}
              </button>
            </div>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center text-center text-sm italic text-muted">
              Selecciona una PQRS para ver el detalle y responderla.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-theme bg-surface px-4 py-3 text-center shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-1 text-xl font-black text-primary">{value}</p>
    </div>
  );
}

function TicketBadge({ value }: { value: PqrsStatus }) {
  const tones: Record<PqrsStatus, string> = {
    NUEVO: 'bg-blue-100 text-blue-700',
    EN_REVISION: 'bg-amber-100 text-amber-700',
    RESPONDIDO: 'bg-emerald-100 text-emerald-700',
    CERRADO: 'bg-zinc-200 text-zinc-700',
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tones[value]}`}
    >
      {value.replace('_', ' ')}
    </span>
  );
}
