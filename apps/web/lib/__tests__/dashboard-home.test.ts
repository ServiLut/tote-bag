import {
  canViewDashboardAdminMetrics,
  getDashboardHealthTone,
} from '../dashboard-home';

describe('dashboard home helpers', () => {
  it('solo expone metricas admin-only al rol ADMIN', () => {
    expect(canViewDashboardAdminMetrics('ADMIN')).toBe(true);
    expect(canViewDashboardAdminMetrics('MANAGER')).toBe(false);
    expect(canViewDashboardAdminMetrics('CUSTOMER')).toBe(false);
    expect(canViewDashboardAdminMetrics(null)).toBe(false);
  });

  it('ignora alertas admin-only al calcular el estado para manager', () => {
    expect(
      getDashboardHealthTone('MANAGER', {
        lowStockCount: 0,
        staleBatches: 6,
        monthlyCashFlowNet: -250000,
      }),
    ).toBe('success');
  });

  it('mantiene alertas visibles para admin', () => {
    expect(
      getDashboardHealthTone('ADMIN', {
        lowStockCount: 0,
        staleBatches: 1,
        monthlyCashFlowNet: 1000,
      }),
    ).toBe('warning');
    expect(
      getDashboardHealthTone('ADMIN', {
        lowStockCount: 0,
        staleBatches: 0,
        monthlyCashFlowNet: -1,
      }),
    ).toBe('warning');
  });
});
