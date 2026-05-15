'use client';

import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';
import { createClient } from '@/utils/supabase/client';
import { canAccessDashboardPath } from '@/lib/frontend-routing';
import { useDashboardAuth } from './DashboardAuthContext';

interface DashboardNotificationStats {
  pendingQuotes: number;
  newPqrsCount: number;
  pendingPaymentOrders: number;
  pendingShipments: number;
  pendingPersonalizationRequests: number;
}

export interface DashboardNotificationCounts {
  total: number;
  byHref: Record<string, number>;
  status: 'idle' | 'ready' | 'error';
  errorMessage: string | null;
}

const EMPTY_NOTIFICATION_COUNTS: DashboardNotificationCounts = {
  total: 0,
  byHref: {},
  status: 'idle',
  errorMessage: null,
};

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeDashboardNotificationStats(
  value: unknown,
): DashboardNotificationStats | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const pendingQuotes = toFiniteNumber(candidate.pendingQuotes);
  const newPqrsCount = toFiniteNumber(candidate.newPqrsCount);
  const pendingPaymentOrders = toFiniteNumber(candidate.pendingPaymentOrders);
  const pendingShipments = toFiniteNumber(candidate.pendingShipments);
  const pendingPersonalizationRequests = toFiniteNumber(
    candidate.pendingPersonalizationRequests,
  );

  if (
    pendingQuotes === null ||
    newPqrsCount === null ||
    pendingPaymentOrders === null ||
    pendingShipments === null ||
    pendingPersonalizationRequests === null
  ) {
    return null;
  }

  return {
    pendingQuotes,
    newPqrsCount,
    pendingPaymentOrders,
    pendingShipments,
    pendingPersonalizationRequests,
  };
}

function buildNotificationCounts(
  role: ReturnType<typeof useDashboardAuth>['role'],
  stats: DashboardNotificationStats,
): DashboardNotificationCounts {
  const rawByHref: Record<string, number> = {
    '/dashboard/orders': stats.pendingPaymentOrders,
    '/dashboard/b2b': stats.pendingQuotes,
    '/dashboard/personalizaciones': stats.pendingPersonalizationRequests,
    '/dashboard/pqrs': stats.newPqrsCount,
    '/dashboard/logistica/envios': stats.pendingShipments,
  };

  const byHref = Object.fromEntries(
    Object.entries(rawByHref).map(([href, count]) => [
      href,
      canAccessDashboardPath(role, href) ? count : 0,
    ]),
  );

  const total = Object.values(byHref).reduce((sum, count) => sum + count, 0);

  return {
    total,
    byHref,
    status: 'ready',
    errorMessage: null,
  };
}

export function useDashboardNotifications() {
  const { role } = useDashboardAuth();
  const [counts, setCounts] = useState<DashboardNotificationCounts>(
    EMPTY_NOTIFICATION_COUNTS,
  );
  const supabase = createClient();

  const markNotificationError = useCallback((message: string) => {
    setCounts((current) => ({
      ...current,
      status: 'error',
      errorMessage: message,
    }));
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!canAccessDashboardPath(role, '/dashboard')) {
      setCounts(EMPTY_NOTIFICATION_COUNTS);
      return;
    }

    try {
      const headers = await getAuthHeaders();

      if (!headers.Authorization) {
        markNotificationError('No se pudo validar la sesion para cargar notificaciones.');
        return;
      }

      const response = await apiFetch('/dashboard/stats', {
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        markNotificationError(
          `No se pudieron cargar las notificaciones del dashboard (${response.status}).`,
        );
        return;
      }

      const body = await response.json();
      const payload = body.data || body || {};
      const stats = normalizeDashboardNotificationStats(payload);

      if (!stats) {
        markNotificationError(
          'La respuesta de notificaciones llego incompleta o con un formato invalido.',
        );
        return;
      }

      setCounts(buildNotificationCounts(role, stats));
    } catch (error) {
      console.error('Error loading dashboard notifications:', error);
      markNotificationError(
        'Hubo un error inesperado al sincronizar las notificaciones del dashboard.',
      );
    }
  }, [markNotificationError, role]);

  useEffect(() => {
    const triggerLoad = () => {
      void loadNotifications();
    };

    const timeoutId = window.setTimeout(triggerLoad, 0);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        triggerLoad();
      }
    }, 15000);

    window.addEventListener('focus', triggerLoad);
    document.addEventListener('visibilitychange', triggerLoad);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      window.removeEventListener('focus', triggerLoad);
      document.removeEventListener('visibilitychange', triggerLoad);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token) {
          setCounts(EMPTY_NOTIFICATION_COUNTS);
          return;
        }

        void loadNotifications();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [loadNotifications, supabase.auth]);

  return counts;
}
