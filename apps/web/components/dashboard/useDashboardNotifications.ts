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
}

const EMPTY_NOTIFICATION_COUNTS: DashboardNotificationCounts = {
  total: 0,
  byHref: {},
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
  };
}

export function useDashboardNotifications() {
  const { role } = useDashboardAuth();
  const [counts, setCounts] = useState<DashboardNotificationCounts>(
    EMPTY_NOTIFICATION_COUNTS,
  );
  const supabase = createClient();

  const loadNotifications = useCallback(async () => {
    if (!canAccessDashboardPath(role, '/dashboard')) {
      setCounts(EMPTY_NOTIFICATION_COUNTS);
      return;
    }

    try {
      const headers = await getAuthHeaders();

      if (!headers.Authorization) {
        setCounts(EMPTY_NOTIFICATION_COUNTS);
        return;
      }

      const response = await apiFetch('/dashboard/stats', {
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        setCounts(EMPTY_NOTIFICATION_COUNTS);
        return;
      }

      const body = await response.json();
      const payload = body.data || body || {};
      const stats = normalizeDashboardNotificationStats(payload);

      if (!stats) {
        setCounts(EMPTY_NOTIFICATION_COUNTS);
        return;
      }

      setCounts(buildNotificationCounts(role, stats));
    } catch (error) {
      console.error('Error loading dashboard notifications:', error);
      setCounts(EMPTY_NOTIFICATION_COUNTS);
    }
  }, [role]);

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
