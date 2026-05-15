import type { DashboardRole } from '@/lib/dashboard-auth';

type DashboardHealthStats = {
  lowStockCount: number;
  staleBatches: number;
  monthlyCashFlowNet: number;
};

export function canViewDashboardAdminMetrics(
  role: DashboardRole | null | undefined,
) {
  return role === 'ADMIN';
}

export function getDashboardHealthTone(
  role: DashboardRole | null | undefined,
  stats: DashboardHealthStats,
) {
  if (stats.lowStockCount > 0) {
    return 'warning' as const;
  }

  if (
    canViewDashboardAdminMetrics(role) &&
    (stats.staleBatches > 0 || stats.monthlyCashFlowNet < 0)
  ) {
    return 'warning' as const;
  }

  return 'success' as const;
}
