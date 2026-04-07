'use client';

import { createContext, useContext } from 'react';
import type { DashboardRole } from '@/lib/dashboard-auth';

export type { DashboardRole } from '@/lib/dashboard-auth';

interface DashboardAuthContextValue {
  role: DashboardRole;
  accessToken: string | null;
}

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);

interface DashboardAuthProviderProps {
  role: DashboardRole;
  accessToken: string | null;
  children: React.ReactNode;
}

export function DashboardAuthProvider({
  role,
  accessToken,
  children,
}: DashboardAuthProviderProps) {
  return (
    <DashboardAuthContext.Provider value={{ role, accessToken }}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const ctx = useContext(DashboardAuthContext);
  if (!ctx) {
    throw new Error('useDashboardAuth must be used within DashboardAuthProvider');
  }
  return ctx;
}
