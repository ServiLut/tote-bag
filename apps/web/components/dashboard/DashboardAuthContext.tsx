'use client';

import { createContext, useContext } from 'react';

export type DashboardRole = 'ADMIN' | 'MANAGER' | 'ADVISOR' | 'VIEWER' | 'CUSTOMER';

interface DashboardAuthContextValue {
  role: DashboardRole;
}

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);

interface DashboardAuthProviderProps {
  role: DashboardRole;
  children: React.ReactNode;
}

export function DashboardAuthProvider({ role, children }: DashboardAuthProviderProps) {
  return (
    <DashboardAuthContext.Provider value={{ role }}>
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
