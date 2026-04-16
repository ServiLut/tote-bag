'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Select } from '@tote-bag/ui';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import {
  canUseDashboardDebugRole,
  DASHBOARD_DEBUG_ROLE_COOKIE_NAME,
  DASHBOARD_DEBUG_ROLE_OPTIONS,
  getDashboardRoleLabel,
  type DashboardRole,
} from '@/lib/dashboard-auth';

const ROLE_OPTIONS = DASHBOARD_DEBUG_ROLE_OPTIONS.map((role) => ({
  value: role,
  label: getDashboardRoleLabel(role),
}));

function setSessionCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
}

interface DashboardRoleSwitcherProps {
  role: DashboardRole;
  accessToken: string | null;
  debugRoleAllowed: boolean;
}

export function DashboardRoleSwitcher({
  role,
  accessToken,
  debugRoleAllowed,
}: DashboardRoleSwitcherProps) {
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  if (!canUseDashboardDebugRole(debugRoleAllowed)) {
    return null;
  }

  const activeLabel = getDashboardRoleLabel(role);

  const handleChange = async (nextRole: string) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? accessToken;

      if (!token) {
        throw new Error('No se pudo obtener la sesion actual.');
      }

      const response = await fetch('/api/proxy/auth/debug/change-role', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newRole: nextRole }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message =
          body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
            ? body.message
            : 'No se pudo cambiar el rol QA.';
        throw new Error(message);
      }

      const selectedRole = nextRole as DashboardRole;
      setSessionCookie(DASHBOARD_DEBUG_ROLE_COOKIE_NAME, selectedRole);
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo cambiar el rol QA.';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-14 min-w-[156px] flex-col justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/5 px-2.5 py-1.5 shadow-sm">
      <div className="mb-1 flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted">
            QA
          </p>
          <p className="truncate text-[10px] font-bold text-primary">
            Activo: {activeLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-base px-1 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-primary">
          <RefreshCw className="h-2 w-2" />
          On
        </span>
      </div>

      <Select
        className="w-full rounded-md border border-theme bg-base px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-primary outline-none disabled:cursor-not-allowed disabled:opacity-60"
        value={role}
        onChange={(event) => {
          void handleChange(event.target.value);
        }}
        disabled={isSaving}
      >
        {ROLE_OPTIONS.map((roleOption) => (
          <option key={roleOption.value} value={roleOption.value}>
            {roleOption.label}
          </option>
        ))}
      </Select>

      <div className="mt-1 flex items-center justify-end gap-2">
        {isSaving ? (
          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] text-primary">
            <RefreshCw className="h-2 w-2 animate-spin" />
            Guardando
          </span>
        ) : null}
      </div>

    </div>
  );
}
