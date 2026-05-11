'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Database,
  Edit3,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  InputGroup,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
} from '@tote-bag/ui';
import {
  createCurrencyInputState,
  handleCurrencyInputChangeWithState,
} from '@/lib/numeric-input';
import {
  FINANCE_DATA_CHANGED_EVENT,
  notifyFinanceDataChanged,
} from '@/lib/finance-events';
import { useDashboardAuth } from '@/components/dashboard/DashboardAuthContext';
import { ReceiptUpload } from '@/components/dashboard/ReceiptUpload';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';

type Supplier = {
  id: string;
  name: string;
  nit: string;
};

type PurchasePayment = {
  id: string;
  amount: string | number;
  paymentDate: string;
  proofUrl?: string | null;
  createdAt?: string;
};

type PurchaseInvoice = {
  id: string;
  totalAmount: string | number;
  paidAmount: string | number;
  balanceDue: string | number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
  issueDate: string;
  createdAt?: string;
  supplier?: Supplier | null;
  payments?: PurchasePayment[];
};

type InvoiceFormState = {
  supplierId: string;
  totalAmountInput: string;
  totalAmount: number;
  issueDate: string;
};

type PaymentFormState = {
  amountInput: string;
  amount: number;
  paymentDate: string;
  proofUrl: string;
};

type PaymentEditorState = {
  invoiceId: string;
  paymentId: string;
};

function formatCurrency(value: string | number | null | undefined) {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = safeAmount < 0 ? '-' : '';
  const absoluteAmount = Math.abs(safeAmount);
  const fixedAmount = absoluteAmount.toFixed(2);
  const [integerPart, decimalPart] = fixedAmount.split('.');
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${sign}$\u00a0${formattedInteger},${decimalPart}`;
}

function getNumericAmount(value: string | number | null | undefined) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Sin fecha';
  }

  const datePart = value.slice(0, 10);
  const safeDate = new Date(`${datePart}T12:00:00.000Z`);

  if (Number.isNaN(safeDate.getTime())) {
    return datePart;
  }

  return safeDate.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function serializeDecimalForApi(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function serializeDateForApi(value: string) {
  return `${value}T12:00:00.000Z`;
}

function parseApiErrorBody(rawText: string, fallbackMessage: string) {
  if (!rawText.trim()) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(rawText) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      return parsed.message.join(', ');
    }

    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message;
    }

    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    return rawText.trim() || fallbackMessage;
  }

  return fallbackMessage;
}

function isDirectSupportUrl(value: string | null | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function extractSupportUrl(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    signedUrl?: unknown;
    url?: unknown;
    data?: {
      signedUrl?: unknown;
      url?: unknown;
    };
  };

  if (typeof candidate.signedUrl === 'string') {
    return candidate.signedUrl;
  }

  if (typeof candidate.url === 'string') {
    return candidate.url;
  }

  if (!candidate.data || typeof candidate.data !== 'object') {
    return null;
  }

  if (typeof candidate.data.signedUrl === 'string') {
    return candidate.data.signedUrl;
  }

  if (typeof candidate.data.url === 'string') {
    return candidate.data.url;
  }

  return null;
}

function extractStorageRef(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    storageRef?: unknown;
    data?: {
      storageRef?: unknown;
    };
  };

  if (typeof candidate.storageRef === 'string') {
    return candidate.storageRef;
  }

  if (
    candidate.data &&
    typeof candidate.data === 'object' &&
    typeof candidate.data.storageRef === 'string'
  ) {
    return candidate.data.storageRef;
  }

  return null;
}

function extractPurchasePaymentId(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as {
    payment?: { id?: unknown };
    data?: {
      payment?: { id?: unknown };
    };
  };

  if (typeof candidate.payment?.id === 'string') {
    return candidate.payment.id;
  }

  if (typeof candidate.data?.payment?.id === 'string') {
    return candidate.data.payment.id;
  }

  return null;
}

function createInvoiceFormState(invoice?: PurchaseInvoice | null): InvoiceFormState {
  const totalAmount = getNumericAmount(invoice?.totalAmount);
  const amountState =
    totalAmount > 0
      ? createCurrencyInputState(totalAmount)
      : createCurrencyInputState('');

  return {
    supplierId: invoice?.supplier?.id ?? '',
    totalAmountInput: amountState.formattedValue,
    totalAmount: amountState.numericValue,
    issueDate:
      invoice?.issueDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

function createPaymentFormState(
  invoice?: PurchaseInvoice | null,
  payment?: PurchasePayment | null,
): PaymentFormState {
  const baseAmount =
    payment ? getNumericAmount(payment.amount) : getNumericAmount(invoice?.balanceDue);
  const amountState =
    baseAmount > 0 ? createCurrencyInputState(baseAmount) : createCurrencyInputState('');

  return {
    amountInput: amountState.formattedValue,
    amount: amountState.numericValue,
    paymentDate:
      payment?.paymentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    proofUrl: payment?.proofUrl ?? '',
  };
}

export default function PurchaseInvoicingPage() {
  const { accessToken } = useDashboardAuth();
  const router = useRouter();
  const supabase = createClient();
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING' | 'PARTIAL' | 'PAID'
  >('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [proofsInvoiceId, setProofsInvoiceId] = useState<string | null>(null);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(
    createInvoiceFormState(),
  );
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(
    createPaymentFormState(),
  );
  const [pendingPaymentProofFile, setPendingPaymentProofFile] = useState<File | null>(
    null,
  );
  const [openingProofPaymentId, setOpeningProofPaymentId] = useState<string | null>(
    null,
  );
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<PaymentEditorState | null>(null);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoices, selectedInvoiceId],
  );

  const editingInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === editingInvoiceId) ?? null,
    [invoices, editingInvoiceId],
  );

  const selectedPayment = useMemo(() => {
    if (!editingPayment) {
      return null;
    }

    const invoice = invoices.find((item) => item.id === editingPayment.invoiceId);
    return (
      invoice?.payments?.find((payment) => payment.id === editingPayment.paymentId) ?? null
    );
  }, [editingPayment, invoices]);

  const proofsInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === proofsInvoiceId) ?? null,
    [invoices, proofsInvoiceId],
  );

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token ?? accessToken;

    if (!token) {
      throw new Error('Tu sesion expiro o no esta disponible. Inicia sesion nuevamente.');
    }

    return { Authorization: `Bearer ${token}` };
  }, [accessToken, supabase.auth]);

  const resolveApiErrorMessage = useCallback(
    async (response: Response, fallbackMessage: string) => {
      if (response.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return 'Tu sesion expiro. Inicia sesion nuevamente.';
      }

      if (response.status === 403) {
        return 'No tienes permisos para gestionar pagos y facturacion de abastecimiento.';
      }

      const rawText = await response.text();
      return parseApiErrorBody(rawText, fallbackMessage);
    },
    [router],
  );

  const uploadPurchasePaymentProof = useCallback(
    async (paymentId: string, file: File, headers: Record<string, string>) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch(
        `/payments/upload-receipt/purchase-payment/${paymentId}`,
        {
          method: 'POST',
          headers,
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            response,
            'No fue posible guardar el comprobante del abono.',
          ),
        );
      }

      return response.json().catch(() => null);
    },
    [resolveApiErrorMessage],
  );

  const openPaymentProof = useCallback(
    async (paymentId: string, proofUrl: string) => {
      if (isDirectSupportUrl(proofUrl)) {
        window.open(proofUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      setOpeningProofPaymentId(paymentId);

      try {
        const headers = await getAuthHeaders();
        const response = await apiFetch(
          `/payments/supports/purchase-payment/${paymentId}/signed-url`,
          {
            headers,
            cache: 'no-store',
          },
        );

        if (!response.ok) {
          throw new Error(
            await resolveApiErrorMessage(
              response,
              'No fue posible abrir el comprobante del abono.',
            ),
          );
        }

        const payload = await response.json().catch(() => null);
        const signedUrl = extractSupportUrl(payload);

        if (!signedUrl) {
          throw new Error('El comprobante del abono no tiene una URL valida.');
        }

        window.open(signedUrl, '_blank', 'noopener,noreferrer');
      } catch (openError) {
        setError(
          openError instanceof Error
            ? openError.message
            : 'No fue posible abrir el comprobante del abono.',
        );
      } finally {
        setOpeningProofPaymentId(null);
      }
    },
    [getAuthHeaders, resolveApiErrorMessage],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const [invoicesRes, suppliersRes] = await Promise.all([
        apiFetch('/purchase-invoices', { headers }),
        apiFetch('/inventory/suppliers', { headers }),
      ]);

      if (!invoicesRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            invoicesRes,
            'No fue posible cargar las facturas de compra.',
          ),
        );
      }

      if (!suppliersRes.ok) {
        throw new Error(
          await resolveApiErrorMessage(
            suppliersRes,
            'No fue posible cargar los proveedores.',
          ),
        );
      }

      const [invoicesBody, suppliersBody] = await Promise.all([
        invoicesRes.json(),
        suppliersRes.json(),
      ]);

      setInvoices(invoicesBody.data || invoicesBody || []);
      setSuppliers(suppliersBody.data || suppliersBody || []);
    } catch (fetchError) {
      console.error('Error loading purchase invoicing view:', fetchError);
      setInvoices([]);
      setSuppliers([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'No fue posible cargar la vista de pagos y facturacion.',
      );
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, resolveApiErrorMessage]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleFinanceRefresh = () => {
      void fetchData();
    };

    window.addEventListener(FINANCE_DATA_CHANGED_EVENT, handleFinanceRefresh);

    return () => {
      window.removeEventListener(FINANCE_DATA_CHANGED_EVENT, handleFinanceRefresh);
    };
  }, [fetchData]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        if (!session?.access_token && !accessToken) {
          setInvoices([]);
          setSuppliers([]);
          setLoading(false);
          return;
        }

        void fetchData();
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [accessToken, fetchData, supabase.auth]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (statusFilter !== 'ALL' && invoice.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        invoice.id,
        invoice.status,
        invoice.supplier?.name || '',
        invoice.supplier?.nit || '',
        invoice.issueDate || '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [invoices, search, statusFilter]);

  const metrics = useMemo(
    () =>
      invoices.reduce(
        (accumulator, invoice) => {
          accumulator.total += getNumericAmount(invoice.totalAmount);
          accumulator.paid += getNumericAmount(invoice.paidAmount);
          accumulator.due += getNumericAmount(invoice.balanceDue);

          if (invoice.status === 'PENDING') {
            accumulator.pending += 1;
          }

          if (invoice.status === 'PARTIAL') {
            accumulator.partial += 1;
          }

          if (invoice.status === 'PAID') {
            accumulator.paidCount += 1;
          }

          return accumulator;
        },
        {
          total: 0,
          paid: 0,
          due: 0,
          pending: 0,
          partial: 0,
          paidCount: 0,
        },
      ),
    [invoices],
  );

  const openCreateModal = () => {
    setInvoiceForm(createInvoiceFormState());
    setEditingInvoiceId(null);
    setSuccessMessage(null);
    setError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (invoice: PurchaseInvoice) => {
    setEditingInvoiceId(invoice.id);
    setInvoiceForm(createInvoiceFormState(invoice));
    setSuccessMessage(null);
    setError(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (submittingInvoice) {
      return;
    }

    setIsCreateModalOpen(false);
    setEditingInvoiceId(null);
    setInvoiceForm(createInvoiceFormState());
  };

  const openPaymentModal = (
    invoice: PurchaseInvoice,
    payment?: PurchasePayment | null,
  ) => {
    setSelectedInvoiceId(invoice.id);
    setEditingPayment(
      payment
        ? {
            invoiceId: invoice.id,
            paymentId: payment.id,
          }
        : null,
    );
    setPaymentForm(createPaymentFormState(invoice, payment));
    setPendingPaymentProofFile(null);
    setSuccessMessage(null);
    setError(null);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    if (submittingPayment) {
      return;
    }

    setIsPaymentModalOpen(false);
    setSelectedInvoiceId(null);
    setEditingPayment(null);
    setPaymentForm(createPaymentFormState());
    setPendingPaymentProofFile(null);
  };

  const openProofsModal = (invoice: PurchaseInvoice) => {
    setProofsInvoiceId(invoice.id);
    setSuccessMessage(null);
    setError(null);
  };

  const closeProofsModal = () => {
    setProofsInvoiceId(null);
  };

  const handleInvoiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!invoiceForm.supplierId) {
      setError('Selecciona un proveedor para registrar la factura.');
      return;
    }

    if (invoiceForm.totalAmount <= 0) {
      setError('El total de la factura debe ser mayor a cero.');
      return;
    }

    if (!invoiceForm.issueDate) {
      setError('Selecciona una fecha de factura valida.');
      return;
    }

    setSubmittingInvoice(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const headers = await getAuthHeaders();
      const isEditing = Boolean(editingInvoiceId);
      const response = await apiFetch(
        isEditing ? `/purchase-invoices/${editingInvoiceId}` : '/purchase-invoices',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            supplierId: invoiceForm.supplierId,
            totalAmount: serializeDecimalForApi(invoiceForm.totalAmount),
            issueDate: serializeDateForApi(invoiceForm.issueDate),
          }),
        },
      );

      if (!response.ok) {
        setError(
          await resolveApiErrorMessage(
            response,
            `No fue posible ${isEditing ? 'actualizar' : 'registrar'} la factura de compra.`,
          ),
        );
        return;
      }

      setIsCreateModalOpen(false);
      setEditingInvoiceId(null);
      setInvoiceForm(createInvoiceFormState());
      setSuccessMessage(
        `Factura de compra ${isEditing ? 'actualizada' : 'registrada'} correctamente.`,
      );
      toast.success(
        isEditing ? 'Factura de compra actualizada.' : 'Factura de compra creada.',
      );
      notifyFinanceDataChanged();
      await fetchData();
    } catch (submitError) {
      console.error('Error saving purchase invoice:', submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : `No fue posible ${editingInvoiceId ? 'actualizar' : 'registrar'} la factura de compra.`,
      );
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoice: PurchaseInvoice) => {
    if (deletingInvoiceId) {
      return;
    }

    if ((invoice.payments?.length ?? 0) > 0) {
      setError('No puedes borrar una factura que ya tiene pagos registrados.');
      return;
    }

    const confirmed = window.confirm(
      `¿Deseas borrar la factura de ${invoice.supplier?.name || 'este proveedor'} por ${formatCurrency(invoice.totalAmount)}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingInvoiceId(invoice.id);
    setError(null);
    setSuccessMessage(null);

    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch(`/purchase-invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: {
          ...headers,
        },
      });

      if (!response.ok) {
        setError(
          await resolveApiErrorMessage(
            response,
            'No fue posible borrar la factura de compra.',
          ),
        );
        return;
      }

      if (editingInvoiceId === invoice.id) {
        closeCreateModal();
      }

      setSuccessMessage('Factura de compra eliminada correctamente.');
      toast.success('Factura de compra eliminada.');
      notifyFinanceDataChanged();
      await fetchData();
    } catch (deleteError) {
      console.error('Error deleting purchase invoice:', deleteError);
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No fue posible borrar la factura de compra.',
      );
    } finally {
      setDeletingInvoiceId(null);
    }
  };

  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedInvoice) {
      setError('Selecciona una factura antes de registrar el abono.');
      return;
    }

    const balanceDue = getNumericAmount(selectedInvoice.balanceDue);
    const selectedPaymentAmount = getNumericAmount(selectedPayment?.amount);
    const availableBalance = editingPayment
      ? balanceDue + selectedPaymentAmount
      : balanceDue;

    if (paymentForm.amount <= 0) {
      setError('El abono debe ser mayor a cero.');
      return;
    }

    if (paymentForm.amount > availableBalance) {
      setError('El abono no puede superar la deuda pendiente.');
      return;
    }

    if (!paymentForm.paymentDate) {
      setError('Selecciona una fecha de pago valida.');
      return;
    }

    const trimmedProofUrl = paymentForm.proofUrl.trim();
    const proofFile = pendingPaymentProofFile;

    setSubmittingPayment(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const headers = await getAuthHeaders();
      const isEditingPayment = Boolean(editingPayment);
      const response = await apiFetch(
        isEditingPayment
          ? `/purchase-invoices/${selectedInvoice.id}/payments/${editingPayment?.paymentId}`
          : `/purchase-invoices/${selectedInvoice.id}/payments`,
        {
          method: isEditingPayment ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            amount: serializeDecimalForApi(paymentForm.amount),
            paymentDate: serializeDateForApi(paymentForm.paymentDate),
            ...(!proofFile && trimmedProofUrl ? { proofUrl: trimmedProofUrl } : {}),
          }),
        },
      );

      if (!response.ok) {
        setError(
          await resolveApiErrorMessage(
            response,
            'No fue posible registrar el abono de la factura.',
          ),
        );
        return;
      }

      const responseBody = await response.json().catch(() => null);
      const paymentId =
        extractPurchasePaymentId(responseBody) ?? editingPayment?.paymentId ?? null;
      let uploadWarning: string | null = null;

      if (proofFile) {
        if (!paymentId) {
          uploadWarning =
            'El abono se guardo, pero no se pudo asociar el comprobante porque la API no devolvio el identificador del pago.';
        } else {
          try {
            const uploadPayload = await uploadPurchasePaymentProof(
              paymentId,
              proofFile,
              headers,
            );
            const storageRef = extractStorageRef(uploadPayload);
            if (storageRef && !isDirectSupportUrl(storageRef)) {
              setPaymentForm((current) => ({
                ...current,
                proofUrl: storageRef,
              }));
            }
          } catch (uploadError) {
            uploadWarning =
              uploadError instanceof Error
                ? uploadError.message
                : 'El abono se guardo, pero no fue posible subir el comprobante.';
          }
        }
      }

      setIsPaymentModalOpen(false);
      setPaymentForm(createPaymentFormState());
      setPendingPaymentProofFile(null);
      setSelectedInvoiceId(null);
      setEditingPayment(null);
      notifyFinanceDataChanged();
      await fetchData();

      if (uploadWarning) {
        setError(uploadWarning);
        toast.error(uploadWarning);
      } else {
        setSuccessMessage(
          isEditingPayment
            ? 'Abono actualizado correctamente.'
            : 'Abono registrado correctamente.',
        );
        toast.success(
          isEditingPayment
            ? 'Abono actualizado en la factura.'
            : 'Abono aplicado a la factura.',
        );
      }
    } catch (submitError) {
      console.error('Error creating purchase payment:', submitError);
      setError(
        submitError instanceof Error
                  ? submitError.message
          : `No fue posible ${editingPayment ? 'actualizar' : 'registrar'} el abono de la factura.`,
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  const createFormDisabled =
    submittingInvoice ||
    !invoiceForm.supplierId ||
    !invoiceForm.issueDate ||
    invoiceForm.totalAmount <= 0;

  const paymentFormDisabled =
    submittingPayment ||
    !selectedInvoice ||
    !paymentForm.paymentDate ||
    paymentForm.amount <= 0 ||
    paymentForm.amount >
      (editingPayment
        ? getNumericAmount(selectedInvoice.balanceDue) +
          getNumericAmount(selectedPayment?.amount)
        : getNumericAmount(selectedInvoice.balanceDue));

  return (
    <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 p-8 duration-500 md:p-12">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20">
              <Receipt className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-primary">
              Pagos y Facturacion
            </h1>
          </div>
          <p className="font-medium text-muted">
            Controla facturas de proveedores, abonos aplicados y deuda pendiente
            del abastecimiento.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Nueva factura
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Facturas activas"
          value={String(invoices.length)}
          detail={`${metrics.pending} pendientes - ${metrics.partial} parciales`}
          icon={<Database className="h-5 w-5" />}
        />
        <MetricCard
          label="Total facturado"
          value={formatCurrency(metrics.total)}
          detail={`${metrics.paidCount} facturas pagadas`}
          icon={<Receipt className="h-5 w-5" />}
        />
        <MetricCard
          label="Abonado"
          value={formatCurrency(metrics.paid)}
          detail="Pagos aplicados en backend"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Deuda pendiente"
          value={formatCurrency(metrics.due)}
          detail="Saldo por cubrir con proveedores"
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="border-b border-theme bg-base/30 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por proveedor, NIT o estado..."
                className="w-full rounded-xl border border-theme bg-base py-2.5 pl-10 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as 'ALL' | 'PENDING' | 'PARTIAL' | 'PAID',
                )
              }
              className="rounded-xl border border-theme bg-base px-4 py-2.5 text-xs font-black text-primary outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="PAID">Pagada</option>
            </Select>
          </div>
        </div>

        {error ? (
          <div className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-theme bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/60">
                <th className="px-8 py-4">Proveedor</th>
                <th className="px-8 py-4">Total</th>
                <th className="px-8 py-4">Abonado</th>
                <th className="px-8 py-4">Deuda</th>
                <th className="px-8 py-4">Estado</th>
                <th className="px-8 py-4">Fecha</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-8 py-14 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-14 text-center">
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                      <div className="rounded-full bg-base p-4">
                        <Receipt className="h-8 w-8 text-muted" />
                      </div>
                      <p className="text-sm font-bold text-muted">
                        {invoices.length === 0
                          ? 'No hay facturas registradas todavia.'
                          : 'No se encontraron facturas con ese filtro.'}
                      </p>
                      {suppliers.length === 0 ? (
                        <Link
                          href="/dashboard/logistica/insumos"
                          className="text-xs font-black uppercase tracking-widest text-primary underline underline-offset-4"
                        >
                          Crear proveedor primero
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => {
                  return (
                    <tr
                      key={invoice.id}
                      className="transition-colors hover:bg-primary/5"
                    >
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">
                            {invoice.supplier?.name || 'Proveedor sin asignar'}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                            {invoice.supplier?.nit || invoice.id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-black text-primary">
                        {formatCurrency(invoice.totalAmount)}
                      </td>
                      <td className="px-8 py-5 font-bold text-emerald-700">
                        {formatCurrency(invoice.paidAmount)}
                      </td>
                      <td className="px-8 py-5 font-bold text-amber-700">
                        {formatCurrency(invoice.balanceDue)}
                      </td>
                      <td className="px-8 py-5">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col gap-1 text-xs font-medium text-muted">
                          <span className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateLabel(invoice.issueDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end">
                          <Popover
                            open={activeActionMenu === invoice.id}
                            onOpenChange={(open) =>
                              setActiveActionMenu(open ? invoice.id : null)
                            }
                          >
                            <PopoverTrigger>
                              <button
                                type="button"
                                className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary transition-colors hover:bg-primary/5"
                                aria-label={`Acciones para factura ${invoice.id.slice(0, 8)}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              side="bottom"
                              align="end"
                              className="w-60 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  openEditModal(invoice);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                              >
                                <Edit3 className="h-4 w-4" />
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={invoice.status === 'PAID'}
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  openPaymentModal(invoice);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Wallet className="h-4 w-4" />
                                {invoice.status === 'PAID'
                                  ? 'Compra completada'
                                  : 'Agregar abono o completar compra'}
                              </button>
                              <button
                                type="button"
                                disabled={(invoice.payments?.length ?? 0) === 0}
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  openProofsModal(invoice);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Paperclip className="h-4 w-4" />
                                {(invoice.payments?.length ?? 0) > 0
                                  ? `Ver y editar abonos (${invoice.payments?.length ?? 0})`
                                  : 'Sin abonos registrados'}
                              </button>
                              <button
                                type="button"
                                disabled={
                                  deletingInvoiceId === invoice.id ||
                                  (invoice.payments?.length ?? 0) > 0
                                }
                                onClick={() => {
                                  setActiveActionMenu(null);
                                  void handleDeleteInvoice(invoice);
                                }}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingInvoiceId === invoice.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Borrar
                              </button>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeCreateModal} />
          <form
            onSubmit={handleInvoiceSubmit}
            className="relative w-full max-w-xl space-y-5 rounded-3xl border border-theme bg-surface p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  {editingInvoice ? 'Editar factura de compra' : 'Nueva factura de compra'}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {editingInvoice
                    ? 'Ajusta proveedor, total y fecha sin perder el historial de pagos ya aplicado.'
                    : 'Registra la obligacion financiera del proveedor desde el dashboard de abastecimiento.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                Proveedor
              </label>
              <Select
                required
                value={invoiceForm.supplierId}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    supplierId: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} - {supplier.nit}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                Total de la factura
              </label>
              <InputGroup
                prefix={<span className="text-xs text-muted">$</span>}
                className="flex items-center gap-1"
              >
                <Input
                  required
                  type="text"
                  inputMode="decimal"
                  value={invoiceForm.totalAmountInput}
                  onChange={(event) =>
                    handleCurrencyInputChangeWithState(event, (nextValue) =>
                      setInvoiceForm((current) => ({
                        ...current,
                        totalAmountInput: nextValue.formattedValue,
                        totalAmount: nextValue.numericValue,
                      })),
                    )
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </InputGroup>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                Fecha de factura
              </label>
              <Input
                required
                type="date"
                value={invoiceForm.issueDate}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    issueDate: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={closeCreateModal}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createFormDisabled}
                className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingInvoice ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  editingInvoice ? 'Guardar cambios' : 'Guardar factura'
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {isPaymentModalOpen && selectedInvoice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closePaymentModal} />
          <form
            onSubmit={handlePaymentSubmit}
            className="relative w-full max-w-2xl space-y-5 rounded-3xl border border-theme bg-surface p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  {editingPayment
                    ? 'Editar abono registrado'
                    : 'Agregar abono o completar compra'}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {editingPayment
                    ? 'Actualiza el abono ya registrado y adjunta el comprobante faltante si aplica para '
                    : 'Aplica un pago a '}
                  <span className="font-black text-primary">
                    {selectedInvoice.supplier?.name || 'la factura seleccionada'}
                  </span>
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentModal}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <SummaryTile
                label="Total"
                value={formatCurrency(selectedInvoice.totalAmount)}
              />
              <SummaryTile
                label="Abonado"
                value={formatCurrency(selectedInvoice.paidAmount)}
              />
              <SummaryTile
                label="Deuda"
                value={formatCurrency(selectedInvoice.balanceDue)}
                tone="amber"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Monto del abono
                </label>
                <InputGroup
                  prefix={<span className="text-xs text-muted">$</span>}
                  className="flex items-center gap-1"
                >
                  <Input
                    required
                    type="text"
                    inputMode="decimal"
                    value={paymentForm.amountInput}
                    onChange={(event) =>
                      handleCurrencyInputChangeWithState(event, (nextValue) =>
                        setPaymentForm((current) => ({
                          ...current,
                          amountInput: nextValue.formattedValue,
                          amount: nextValue.numericValue,
                        })),
                      )
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </InputGroup>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Fecha de pago
                </label>
                <Input
                  required
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      paymentDate: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted">
                  Comprobante del abono
                </label>
                {editingPayment && paymentForm.proofUrl ? (
                  <button
                    type="button"
                    onClick={() =>
                      void openPaymentProof(editingPayment.paymentId, paymentForm.proofUrl)
                    }
                    disabled={openingProofPaymentId === editingPayment.paymentId}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {openingProofPaymentId === editingPayment.paymentId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    Ver archivo cargado
                  </button>
                ) : null}
              </div>

              <div className="rounded-2xl border border-theme bg-base/30 p-4">
                <ReceiptUpload
                  entityId={editingPayment?.paymentId ?? selectedInvoice.id}
                  entityType="purchase-payment"
                  initialUrl={paymentForm.proofUrl || null}
                  deferUpload={!editingPayment}
                  onFileSelected={(file) => setPendingPaymentProofFile(file)}
                  selectedFileName={pendingPaymentProofFile?.name ?? null}
                  onUploadSuccess={(url, storageRef) =>
                    setPaymentForm((current) => ({
                      ...current,
                      proofUrl: storageRef ?? url,
                    }))
                  }
                />
                <p className="mt-3 text-[11px] font-medium text-muted">
                  {editingPayment
                    ? 'El archivo se guarda directamente en el abono y queda disponible al reabrir la factura.'
                    : 'Selecciona el archivo ahora y se asociara al nuevo abono cuando confirmes el pago.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={closePaymentModal}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={paymentFormDisabled}
                className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingPayment ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  editingPayment ? 'Guardar abono' : 'Confirmar abono'
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {proofsInvoice ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeProofsModal} />
          <div
            className="relative w-full max-w-3xl space-y-5 rounded-3xl border border-theme bg-surface p-8 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-primary">
                  Abonos y comprobantes de la factura
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {proofsInvoice.supplier?.name || 'Proveedor sin asignar'} ·{' '}
                  {formatCurrency(proofsInvoice.totalAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeProofsModal}
                className="rounded-xl p-2 text-muted transition-colors hover:bg-base hover:text-primary"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {(proofsInvoice.payments ?? []).length === 0 ? (
                <div className="rounded-2xl border border-theme bg-base/40 px-4 py-6 text-center text-sm font-medium text-muted">
                  Esta factura todavia no tiene abonos registrados.
                </div>
              ) : (
                (proofsInvoice.payments ?? [])
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-3 rounded-2xl border border-theme bg-base/30 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-primary">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="flex items-center gap-2 text-xs font-medium text-muted">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateLabel(payment.paymentDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              payment.proofUrl
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {payment.proofUrl ? 'Con comprobante' : 'Sin comprobante'}
                          </span>
                          <Button
                            type="button"
                            onClick={() => {
                              closeProofsModal();
                              openPaymentModal(proofsInvoice, payment);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl border border-theme bg-base px-4 py-2 text-xs font-black uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-base-color"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Editar abono
                          </Button>
                          {payment.proofUrl ? (
                            <button
                              type="button"
                              onClick={() => void openPaymentProof(payment.id, payment.proofUrl!)}
                              disabled={openingProofPaymentId === payment.id}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-base-color disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {openingProofPaymentId === payment.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <ExternalLink className="h-3.5 w-3.5" />
                              )}
                              Ver comprobante
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={closeProofsModal}
                className="rounded-2xl border border-theme bg-base px-6 py-3 font-bold text-muted"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-theme bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</div>
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <h3 className="mt-1 text-2xl font-black text-primary">{value}</h3>
      <p className="mt-2 text-[11px] font-medium text-muted">{detail}</p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PurchaseInvoice['status'];
}) {
  const config = {
    PENDING: {
      label: 'Pendiente',
      className: 'bg-amber-100 text-amber-700',
      icon: <AlertCircle className="h-3 w-3" />,
    },
    PARTIAL: {
      label: 'Parcial',
      className: 'bg-blue-100 text-blue-700',
      icon: <Wallet className="h-3 w-3" />,
    },
    PAID: {
      label: 'Pagada',
      className: 'bg-emerald-100 text-emerald-700',
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
  } as const;

  const current = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${current.className}`}
    >
      {current.icon}
      {current.label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'amber';
}) {
  const toneStyles =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-theme bg-base/40 text-primary';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneStyles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
        {label}
      </p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}
