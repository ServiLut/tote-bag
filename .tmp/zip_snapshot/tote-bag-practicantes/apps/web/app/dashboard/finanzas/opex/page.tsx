'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Filter,
  Loader2,
  Plus,
  Receipt,
  Search,
  Tag,
  TrendingDown,
  Wallet,
  X,
} from 'lucide-react';
import {
  formatCurrencyInput,
  parseLocalizedNumber,
  sanitizeDecimalInput,
} from '@/lib/numeric-input';
import { CreatableCombobox } from '@/components/ui/CreatableCombobox';
import { notifyFinanceDataChanged } from '@/lib/finance-events';
import { apiFetch } from '@/utils/api';
import { getAuthHeaders } from '@/utils/supabase/auth';

type OpexCategory = {
  id: string;
  name: string;
  description?: string | null;
};

type OpexTransaction = {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  category: string;
  opexCategory?: {
    id: string;
    name: string;
  } | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function OpexPage() {
  const [categories, setCategories] = useState<OpexCategory[]>([]);
  const [transactions, setTransactions] = useState<OpexTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [form, setForm] = useState({
    amount: '',
    description: '',
    opexCategoryId: '',
    createdAt: toDateInputValue(new Date()),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [categoriesRes, transactionsRes] = await Promise.all([
        apiFetch('/inventory/finance/opex-categories', { headers }),
        apiFetch('/inventory/finance/opex-transactions', { headers }),
      ]);

      if (categoriesRes.ok) {
        const body = await categoriesRes.json();
        const nextCategories = body.data || body || [];
        setCategories(nextCategories);
        setForm((current) => ({
          ...current,
          opexCategoryId: current.opexCategoryId || nextCategories[0]?.id || '',
        }));
      } else {
        setCategories([]);
      }

      if (transactionsRes.ok) {
        const body = await transactionsRes.json();
        setTransactions(body.data || body || []);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading opex data:', error);
      setCategories([]);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupedByCategory = useMemo(() => {
    return transactions.reduce<Record<string, number>>((acc, tx) => {
      const key = tx.opexCategory?.name || 'Sin categoria';
      acc[key] = (acc[key] || 0) + tx.amount;
      return acc;
    }, {});
  }, [transactions]);

  const totalOpex = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.amount, 0),
    [transactions],
  );

  const averageTicket = transactions.length > 0 ? totalOpex / transactions.length : 0;

  const currentMonthTotal = useMemo(() => {
    const now = new Date();

    return transactions
      .filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return (
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => filterCategory === 'ALL' || tx.opexCategory?.id === filterCategory,
    );
  }, [filterCategory, transactions]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  );

  const handleAmountChange = (value: string) => {
    const sanitizedValue = sanitizeDecimalInput(value);
    if (sanitizedValue === null) {
      return;
    }

    setForm((current) => ({
      ...current,
      amount: sanitizedValue,
    }));
  };

  const handleCreateCategory = async (label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) {
      return;
    }

    setCreatingCategory(true);
    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch('/inventory/finance/opex-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ name: nextLabel }),
      });

      if (!response.ok) {
        throw new Error('No fue posible crear la categoria.');
      }

      const body = await response.json();
      const createdCategory = body.data || body;

      setCategories((current) => {
        const alreadyExists = current.some((category) => category.id === createdCategory.id);
        if (alreadyExists) {
          return current;
        }

        return [...current, createdCategory].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      });

      setForm((current) => ({
        ...current,
        opexCategoryId: createdCategory.id,
      }));
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      if (!form.opexCategoryId) {
        throw new Error('Selecciona una categoria.');
      }

      const headers = await getAuthHeaders();
      const response = await apiFetch('/inventory/finance/opex', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          amount: parseLocalizedNumber(form.amount),
          description: form.description,
          opexCategoryId: form.opexCategoryId,
          createdAt: form.createdAt,
        }),
      });

      if (!response.ok) {
        throw new Error('No fue posible registrar el gasto.');
      }

      setForm((current) => ({
        ...current,
        amount: '',
        description: '',
      }));
      setIsModalOpen(false);
      await fetchData();
      notifyFinanceDataChanged();
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center p-8 md:p-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted">Cargando gastos operativos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-rose-500 p-2.5 text-white shadow-lg shadow-rose-200">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Gastos Operativos
            </h1>
          </div>
          <p className="font-medium text-muted">
            Control y registro de egresos no relacionados directamente con la produccion.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3 font-bold text-white shadow-lg shadow-rose-200 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-5 w-5" />
          Registrar Gasto
        </button>
      </div>

      <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-rose-100 bg-rose-50 p-8 md:flex-row">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <TrendingDown className="h-8 w-8 text-rose-500" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-400">
              Total Gastado este Mes
            </p>
            <h2 className="text-4xl font-black text-rose-600">
              {formatCurrency(currentMonthTotal)}
            </h2>
          </div>
        </div>
        <div className="text-right">
          <p className="max-w-xs text-sm font-medium text-rose-500/80">
            Este valor incluye nomina, servicios, arriendo y otros gastos fijos del
            periodo actual.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard
          label="Total OpEx"
          value={formatCurrency(totalOpex)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <MetricCard
          label="Movimientos"
          value={String(transactions.length)}
          icon={<Receipt className="h-5 w-5" />}
        />
        <MetricCard
          label="Ticket promedio"
          value={formatCurrency(averageTicket)}
          icon={<Tag className="h-5 w-5" />}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-theme bg-base/30 p-8 md:flex-row md:items-center">
          <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
            <Search className="h-5 w-5 text-muted" />
            Control de Egresos
          </h2>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted" />
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="rounded-xl border border-theme bg-base px-4 py-2 text-xs font-bold text-primary outline-none transition-all focus:ring-2 focus:ring-rose-500/20"
            >
              <option value="ALL">Todas las Categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                <th className="px-8 py-4">Fecha</th>
                <th className="px-8 py-4">Categoria</th>
                <th className="px-8 py-4">Descripcion</th>
                <th className="px-8 py-4">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center font-medium text-muted">
                    No se encontraron gastos registrados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="group text-sm transition-colors hover:bg-rose-50/30"
                  >
                    <td className="px-8 py-5 font-medium text-muted">
                      {new Date(tx.createdAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                        <Tag className="h-3 w-3" />
                        {tx.opexCategory?.name || tx.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-bold text-primary">{tx.description}</td>
                    <td className="px-8 py-5 font-black text-rose-600">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
          <h2 className="text-xl font-bold text-primary">Desglose por categoria</h2>
          <div className="mt-6 space-y-3">
            {Object.entries(groupedByCategory).length === 0 ? (
              <p className="text-sm italic text-muted">
                No hay gastos operativos registrados.
              </p>
            ) : (
              Object.entries(groupedByCategory).map(([category, amount]) => (
                <div
                  key={category}
                  className="flex items-center justify-between rounded-xl bg-base/40 px-4 py-3"
                >
                  <span className="text-sm font-bold text-muted">{category}</span>
                  <span className="text-sm font-black text-primary">
                    {formatCurrency(amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-theme bg-surface p-8 shadow-sm">
          <h2 className="text-xl font-bold text-primary">Ultimos movimientos</h2>
          <div className="mt-6 space-y-4">
            {transactions.length === 0 ? (
              <p className="text-sm italic text-muted">
                Todavia no hay movimientos para mostrar.
              </p>
            ) : (
              transactions.slice(0, 8).map((tx) => (
                <div key={tx.id} className="rounded-2xl border border-theme bg-base/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-primary">{tx.description}</p>
                      <p className="text-xs font-medium text-muted">
                        {tx.opexCategory?.name || tx.category} ·{' '}
                        {new Date(tx.createdAt).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <span className="text-sm font-black text-rose-600">
                      -{formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 animate-in fade-in bg-primary/20 backdrop-blur-sm duration-300"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="relative z-[61] w-full max-w-lg overflow-visible rounded-3xl border border-theme bg-surface shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="border-b border-theme bg-rose-500 p-8 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">Registrar Gasto</h2>
                  <p className="mt-1 text-sm font-medium text-rose-100">
                    Ingresa un nuevo egreso operativo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl p-2 transition-colors hover:bg-white/10"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Descripcion
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Pago internet febrero"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Categoria
                    </label>
                    <CreatableCombobox
                      options={categoryOptions}
                      value={form.opexCategoryId}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          opexCategoryId: value,
                        }))
                      }
                      onCreate={handleCreateCategory}
                      placeholder="Seleccionar categoria..."
                      searchPlaceholder="Buscar categoria..."
                      emptyMessage="No se encontraron categorias."
                      isLoading={creatingCategory}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                      Monto
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={form.amount ? formatCurrencyInput(form.amount) : ''}
                      onChange={(event) => handleAmountChange(event.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-rose-500/20"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                    Fecha de Pago
                  </label>
                  <input
                    type="date"
                    value={form.createdAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        createdAt: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-rose-500/20"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-2xl border border-theme bg-base px-6 py-4 font-bold text-muted transition-all hover:bg-theme/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-rose-500 px-6 py-4 font-black text-white shadow-xl shadow-rose-200 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                  {submitting ? 'Registrando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
      <h3 className="mt-1 text-2xl font-black text-primary">{value}</h3>
    </div>
  );
}
