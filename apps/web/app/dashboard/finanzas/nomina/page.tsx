'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { Camera, Download, Edit3, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud, Users, Wallet, X } from 'lucide-react';
import { Button, Input } from '@tote-bag/ui';
import { createClient } from '@/utils/supabase/client';
import { apiFetch } from '@/utils/api';
import { notifyFinanceDataChanged } from '@/lib/finance-events';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

type WorkerType = 'EMPLOYEE' | 'CONTRACTOR' | 'TEMPORARY' | 'OTHER';
type StatementStatus = 'PENDIENTE' | 'ENVIADA' | 'PAGADA';

type PayrollWorker = {
  id: number;
  displayName: string;
  documentNumber: string;
  workerType: WorkerType;
  roleName?: string | null;
  hourlyRate: number;
  isActive: boolean;
};

type PayrollShift = {
  id: number;
  collaborator: string;
  workerId: number | null;
  workDate: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes: string;
  hourlyRateApplied: number;
  totalAmount: number;
  entryPhotoUrl?: string | null;
  exitPhotoUrl?: string | null;
  status: 'RECORDED' | 'BILLED' | 'PAID' | 'CANCELLED';
  billingStatementId: number | null;
  worker?: PayrollWorker | null;
};

type PayrollStatement = {
  id: number;
  collaborator: string;
  workerId: number | null;
  statementNumber?: string | null;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: StatementStatus;
  paymentTransactionId?: string | null;
  worker?: PayrollWorker | null;
};

type WorkerHistory = PayrollWorker & {
  shifts: PayrollShift[];
  billingStatements: Array<
    PayrollStatement & {
      shifts: PayrollShift[];
    }
  >;
};

const supabase = createClient();
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type Notice = {
  tone: 'success' | 'error';
  text: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount || 0);
}

function workerLabel(worker?: PayrollWorker | null, collaborator?: string | null) {
  return worker?.displayName || collaborator || 'Sin asignar';
}

function getWorkedMinutes(startTime: string, endTime: string, breakMinutes: number) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm) - breakMinutes);
}

function formatWorkedHours(startTime: string, endTime: string, breakMinutes: number) {
  const workedMinutes = getWorkedMinutes(startTime, endTime, breakMinutes);
  const hours = workedMinutes / 60;

  if (Number.isInteger(hours)) {
    return `${hours} horas`;
  }

  const roundedHours = Math.round(hours * 10) / 10;
  return `${roundedHours.toLocaleString('es-CO', { maximumFractionDigits: 1 })} horas`;
}

function estimateShiftValue(startTime: string, endTime: string, breakMinutes: number, hourlyRate: number) {
  if (!startTime || !endTime || hourlyRate <= 0) return 0;
  const workedMinutes = getWorkedMinutes(startTime, endTime, breakMinutes);
  return Math.round((workedMinutes / 60) * hourlyRate);
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    const message =
      (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ||
      body?.error?.message ||
      body?.error ||
      body?.data?.message;

    return typeof message === 'string' && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

export default function PayrollPage() {
  const [workers, setWorkers] = useState<PayrollWorker[]>([]);
  const [shifts, setShifts] = useState<PayrollShift[]>([]);
  const [statements, setStatements] = useState<PayrollStatement[]>([]);
  const [activeTab, setActiveTab] = useState('workers');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workerModalOpen, setWorkerModalOpen] = useState(false);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [workerHistoryOpen, setWorkerHistoryOpen] = useState(false);
  const [statementDetailOpen, setStatementDetailOpen] = useState(false);
  const [shiftPhotosOpen, setShiftPhotosOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<PayrollWorker | null>(null);
  const [editingShift, setEditingShift] = useState<PayrollShift | null>(null);
  const [selectedShiftPhotos, setSelectedShiftPhotos] = useState<PayrollShift | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<WorkerHistory | null>(null);
  const [selectedStatement, setSelectedStatement] = useState<(PayrollStatement & { shifts?: PayrollShift[] }) | null>(null);
  const [workerForConsolidation, setWorkerForConsolidation] = useState('');
  const [entryPhoto, setEntryPhoto] = useState<File | null>(null);
  const [exitPhoto, setExitPhoto] = useState<File | null>(null);
  const [workerForm, setWorkerForm] = useState({ displayName: '', documentNumber: '', workerType: 'CONTRACTOR' as WorkerType, roleName: '', hourlyRate: '', isActive: true });
  const [shiftForm, setShiftForm] = useState({ workerId: '', workDate: new Date().toISOString().slice(0, 10), startTime: '', endTime: '', breakMinutes: '0', notes: '' });

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Tu sesion expiró. Ingresa de nuevo para gestionar nomina.');
    }
    return { Authorization: `Bearer ${session.access_token}` };
  }, []);

  const showError = useCallback((text: string) => {
    setNotice({ tone: 'error', text });
  }, []);

  const showSuccess = useCallback((text: string) => {
    setNotice({ tone: 'success', text });
  }, []);

  const fetchPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [workersRes, shiftsRes, statementsRes] = await Promise.all([
        apiFetch('/payroll/workers', { headers, cache: 'no-store' }),
        apiFetch('/payroll/shifts', { headers, cache: 'no-store' }),
        apiFetch('/payroll/statements', { headers, cache: 'no-store' }),
      ]);
      if (!workersRes.ok) throw new Error(await getErrorMessage(workersRes, 'No fue posible cargar los trabajadores.'));
      if (!shiftsRes.ok) throw new Error(await getErrorMessage(shiftsRes, 'No fue posible cargar los turnos.'));
      if (!statementsRes.ok) throw new Error(await getErrorMessage(statementsRes, 'No fue posible cargar las cuentas.'));
      const workersBody = workersRes.ok ? await workersRes.json() : [];
      const shiftsBody = shiftsRes.ok ? await shiftsRes.json() : [];
      const statementsBody = statementsRes.ok ? await statementsRes.json() : [];
      setWorkers(workersBody.data || workersBody || []);
      setShifts(shiftsBody.data || shiftsBody || []);
      setStatements(statementsBody.data || statementsBody || []);
    } catch (error) {
      console.error(error);
      showError(error instanceof Error ? error.message : 'No fue posible cargar los datos de nomina.');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, showError]);

  useEffect(() => {
    void fetchPayrollData();
  }, [fetchPayrollData]);

  const workerMap = useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const workerOpenShiftCounts = useMemo(() => shifts.reduce<Record<number, number>>((acc, shift) => {
    if (shift.workerId && (shift.status === 'RECORDED' || shift.status === 'BILLED')) {
      acc[shift.workerId] = (acc[shift.workerId] || 0) + 1;
    }
    return acc;
  }, {}), [shifts]);
  const selectedWorker = shiftForm.workerId ? workerMap.get(Number(shiftForm.workerId)) || null : null;
  const filteredWorkers = useMemo(() => workers.filter((worker) => `${worker.displayName} ${worker.documentNumber}`.toLowerCase().includes(search.toLowerCase())), [search, workers]);
  const filteredShifts = useMemo(() => shifts.filter((shift) => `${workerLabel(shift.worker, shift.collaborator)} ${shift.status} ${shift.workDate}`.toLowerCase().includes(search.toLowerCase())), [search, shifts]);
  const filteredStatements = useMemo(() => statements.filter((statement) => `${workerLabel(statement.worker, statement.collaborator)} ${statement.status} ${statement.statementNumber || ''}`.toLowerCase().includes(search.toLowerCase())), [search, statements]);
  const pendingShifts = useMemo(() => shifts.filter((shift) => shift.status === 'RECORDED' && !shift.billingStatementId), [shifts]);
  const consolidationCandidates = useMemo(() => pendingShifts.filter((shift) => shift.workerId === Number(workerForConsolidation || 0)), [pendingShifts, workerForConsolidation]);
  const historyRows = useMemo(() => {
    const grouped = statements.reduce<Record<number, { workerId: number; name: string; statements: number; billed: number; paid: number }>>((acc, statement) => {
      if (!statement.workerId) return acc;
      const current = acc[statement.workerId] || {
        workerId: statement.workerId,
        name: workerLabel(statement.worker, statement.collaborator),
        statements: 0,
        billed: 0,
        paid: 0,
      };
      current.statements += 1;
      current.billed += statement.totalAmount;
      if (statement.status === 'PAGADA') current.paid += statement.totalAmount;
      acc[statement.workerId] = current;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => b.billed - a.billed);
  }, [statements]);

  const requireImageWithinLimit = (file: File | null, label: string) => {
    if (!file) return true;
    if (file.size <= MAX_IMAGE_SIZE_BYTES) return true;
    showError(`${label} supera el limite de 5 MB.`);
    return false;
  };

  const openWorkerModal = (worker?: PayrollWorker) => {
    setEditingWorker(worker || null);
    setWorkerForm({
      displayName: worker?.displayName || '',
      documentNumber: worker?.documentNumber || '',
      workerType: worker?.workerType || 'CONTRACTOR',
      roleName: worker?.roleName || '',
      hourlyRate: worker ? String(worker.hourlyRate) : '',
      isActive: worker?.isActive ?? true,
    });
    setWorkerModalOpen(true);
    setNotice(null);
  };

  const openShiftModal = (shift?: PayrollShift) => {
    setEditingShift(shift || null);
    setEntryPhoto(null);
    setExitPhoto(null);
    setShiftForm({
      workerId: shift?.workerId ? String(shift.workerId) : '',
      workDate: shift?.workDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      startTime: shift?.startTime || '',
      endTime: shift?.endTime || '',
      breakMinutes: String(shift?.breakMinutes || 0),
      notes: shift?.notes || '',
    });
    setShiftModalOpen(true);
    setNotice(null);
  };

  const openShiftPhotos = (shift: PayrollShift) => {
    setSelectedShiftPhotos(shift);
    setShiftPhotosOpen(true);
  };

  const handleSaveWorker = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (!workerForm.displayName.trim() || !workerForm.documentNumber.trim()) {
        throw new Error('Nombre y documento son obligatorios.');
      }
      if (
        editingWorker &&
        workerForm.isActive === false &&
        (workerOpenShiftCounts[editingWorker.id] || 0) > 0
      ) {
        throw new Error(
          'Este trabajador tiene turnos abiertos. Cierra o paga esos turnos antes de inactivarlo.',
        );
      }
      const headers = await getAuthHeaders();
      const workerPayload = {
        displayName: workerForm.displayName,
        documentNumber: workerForm.documentNumber,
        workerType: workerForm.workerType,
        roleName: workerForm.roleName || undefined,
        hourlyRate: Number(workerForm.hourlyRate || 0),
        ...(editingWorker ? { isActive: workerForm.isActive } : {}),
      };
      const response = await apiFetch(editingWorker ? `/payroll/workers/${editingWorker.id}` : '/payroll/workers', {
        method: editingWorker ? 'PATCH' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(workerPayload),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No fue posible guardar el trabajador.'));
      await fetchPayrollData();
      setWorkerModalOpen(false);
      showSuccess(editingWorker ? 'Trabajador actualizado.' : 'Trabajador creado.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No fue posible guardar el trabajador.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShift = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    if (!shiftForm.workerId) {
      showError('Selecciona un trabajador antes de guardar el turno.');
      setSaving(false);
      return;
    }
    if (!requireImageWithinLimit(entryPhoto, 'La foto de entrada') || !requireImageWithinLimit(exitPhoto, 'La foto de salida')) {
      setSaving(false);
      return;
    }
    if (!shiftForm.startTime || !shiftForm.endTime) {
      showError('Debes indicar hora de entrada y salida.');
      setSaving(false);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const formData = new FormData();
      formData.append('workerId', shiftForm.workerId);
      formData.append('workDate', shiftForm.workDate);
      formData.append('startTime', shiftForm.startTime);
      formData.append('endTime', shiftForm.endTime);
      formData.append('breakMinutes', shiftForm.breakMinutes);
      formData.append('notes', shiftForm.notes);
      if (entryPhoto) formData.append('entryPhoto', entryPhoto);
      if (exitPhoto) formData.append('exitPhoto', exitPhoto);
      const response = await apiFetch(editingShift ? `/payroll/shifts/${editingShift.id}` : '/payroll/shifts', {
        method: editingShift ? 'PATCH' : 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No fue posible guardar el turno.'));
      await fetchPayrollData();
      setShiftModalOpen(false);
      showSuccess(editingShift ? 'Turno actualizado.' : 'Turno creado.');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No fue posible guardar el turno.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    const headers = await getAuthHeaders();
    const response = await apiFetch(`/payroll/shifts/${shiftId}`, { method: 'DELETE', headers });
    if (response.ok) {
      await fetchPayrollData();
      showSuccess('Turno eliminado.');
    } else {
      showError(await getErrorMessage(response, 'No fue posible eliminar el turno.'));
    }
  };

  const handleConsolidate = async () => {
    const workerId = Number(workerForConsolidation || 0);
    if (!workerId || consolidationCandidates.length === 0) {
      showError('Selecciona un trabajador con turnos pendientes.');
      return;
    }
    const headers = await getAuthHeaders();
    const response = await apiFetch('/payroll/statements/consolidate', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId, shiftIds: consolidationCandidates.map((shift) => shift.id) }),
    });
    if (response.ok) {
      await fetchPayrollData();
      showSuccess('Cuenta consolidada.');
    } else {
      showError(await getErrorMessage(response, 'No fue posible consolidar la cuenta.'));
    }
  };

  const handleUpdateStatement = async (statementId: number, status: StatementStatus) => {
    const headers = await getAuthHeaders();
    const response = await apiFetch(`/payroll/statements/${statementId}/status`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      await fetchPayrollData();
      if (status === 'PAGADA') {
        notifyFinanceDataChanged();
      }
      showSuccess(`Cuenta marcada como ${status.toLowerCase()}.`);
    } else {
      showError(await getErrorMessage(response, 'No fue posible actualizar la cuenta.'));
    }
  };

  const handleDownloadPdf = async (statementId: number) => {
    const headers = await getAuthHeaders();
    const response = await apiFetch(`/payroll/statements/${statementId}/pdf`, { headers });
    if (!response.ok) {
      showError(await getErrorMessage(response, 'No fue posible descargar el PDF.'));
      return;
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuenta-cobro-nomina-${statementId}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    showSuccess(`PDF de la cuenta #${statementId} descargado.`);
  };

  const handleOpenWorkerHistory = async (workerId: number) => {
    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch(`/payroll/workers/${workerId}/history`, {
        headers,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No fue posible cargar el historial del trabajador.'));
      const body = await response.json();
      const history = body.data || body;
      setSelectedHistory(history);
      setWorkerHistoryOpen(true);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No fue posible cargar el historial del trabajador.');
    }
  };

  const handleOpenStatementDetail = async (statementId: number) => {
    try {
      const headers = await getAuthHeaders();
      const response = await apiFetch(`/payroll/statements/${statementId}`, {
        headers,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'No fue posible cargar el detalle de la cuenta.'));
      const body = await response.json();
      const statement = body.data || body;
      setSelectedStatement(statement);
      setStatementDetailOpen(true);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'No fue posible cargar el detalle de la cuenta.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-base-color shadow-lg shadow-primary/20"><Wallet className="h-6 w-6" /></div>
            <h1 className="text-3xl font-black tracking-tight text-primary">Nomina</h1>
          </div>
          <p className="font-medium text-muted">Gestion de trabajadores, turnos, cuentas e historial.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => openWorkerModal()} className="rounded-xl border border-theme bg-base px-5 py-3 text-xs font-black uppercase tracking-widest text-primary"><Users className="mr-2 h-4 w-4" />Nuevo trabajador</Button>
          <Button onClick={() => openShiftModal()} className="rounded-xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-base-color"><Plus className="mr-2 h-4 w-4" />Nuevo turno</Button>
        </div>
      </div>

      {notice ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${notice.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {notice.text}
        </div>
      ) : null}

      <div className="rounded-3xl border border-theme bg-surface shadow-sm">
        <div className="flex flex-col gap-4 border-b border-theme bg-base/30 p-6 md:flex-row md:items-center md:justify-between">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar trabajador o estado..." className="w-full max-w-xl rounded-xl border border-theme bg-base px-4 py-2.5 text-sm font-medium md:w-[32rem]" />
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="workers">Empleados</TabsTrigger>
              <TabsTrigger value="shifts">Turnos</TabsTrigger>
              <TabsTrigger value="statements">Cuentas</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="workers" className="p-6">
            <Table loading={loading} headers={['Trabajador', 'Documento', 'Tipo', 'Valor hora', 'Estado', 'Acciones']} emptyMessage="No hay trabajadores registrados.">
              {filteredWorkers.map((worker) => (
                <tr key={worker.id}>
                  <td className="px-4 py-3 font-bold text-primary"><span className="block max-w-52 truncate" title={worker.displayName}>{worker.displayName}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{worker.documentNumber}</td>
                  <td className="px-4 py-3 text-sm text-muted">{worker.workerType}</td>
                  <td className="px-4 py-3 font-bold text-primary">{formatCurrency(worker.hourlyRate)}</td>
                  <td className="px-4 py-3 text-sm text-muted">{worker.isActive ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3"><div className="flex justify-end"><button type="button" onClick={() => openWorkerModal(worker)} className="rounded-lg border border-theme p-2 text-primary transition-colors hover:bg-primary hover:text-base-color"><Edit3 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </Table>
          </TabsContent>

          <TabsContent value="shifts" className="space-y-6 p-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-theme bg-base/30 p-4 md:flex-row md:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted">Trabajador para consolidar</label>
                <select value={workerForConsolidation} onChange={(event) => setWorkerForConsolidation(event.target.value)} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary">
                  <option value="">Selecciona un trabajador</option>
                  {workers.filter((worker) => worker.isActive).map((worker) => <option key={worker.id} value={worker.id}>{worker.displayName}</option>)}
                </select>
              </div>
              <Button onClick={handleConsolidate} className="rounded-xl bg-primary px-5 py-3 text-xs font-black uppercase tracking-widest text-base-color">Cerrar periodo</Button>
            </div>

            <Table loading={loading} headers={['Trabajador', 'Fecha', 'Horario', 'Valor hora', 'Total', 'Estado', 'Acciones']} emptyMessage="No hay turnos registrados.">
              {filteredShifts.map((shift) => (
                <tr key={shift.id}>
                  <td className="px-4 py-3 font-bold text-primary"><span className="block max-w-52 truncate" title={workerLabel(shift.worker, shift.collaborator)}>{workerLabel(shift.worker, shift.collaborator)}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{shift.workDate.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-sm text-muted"><div className="flex flex-col"><span>{shift.startTime} - {shift.endTime}</span><span className="text-[11px] font-bold text-primary/75">{formatWorkedHours(shift.startTime, shift.endTime, shift.breakMinutes)}</span></div></td>
                  <td className="px-4 py-3 text-sm text-muted">{formatCurrency(shift.hourlyRateApplied)}</td>
                  <td className="px-4 py-3 font-bold text-primary">{formatCurrency(shift.totalAmount)}</td>
                  <td className="px-4 py-3 text-sm text-muted">{shift.status}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">{shift.entryPhotoUrl || shift.exitPhotoUrl ? <button type="button" onClick={() => openShiftPhotos(shift)} className="rounded-lg border border-theme p-2 text-primary transition-colors hover:bg-primary hover:text-base-color" title="Ver fotos del turno"><ImageIcon className="h-4 w-4" /></button> : null}<button type="button" disabled={shift.status !== 'RECORDED'} onClick={() => openShiftModal(shift)} className="rounded-lg border border-theme p-2 text-primary transition-colors hover:bg-primary hover:text-base-color disabled:opacity-40"><Edit3 className="h-4 w-4" /></button><button type="button" disabled={shift.status !== 'RECORDED'} onClick={() => void handleDeleteShift(shift.id)} className="rounded-lg border border-theme p-2 text-rose-600 transition-colors hover:bg-rose-600 hover:text-white disabled:opacity-40"><Trash2 className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </Table>
          </TabsContent>

          <TabsContent value="statements" className="p-6">
            <Table loading={loading} headers={['Cuenta', 'Trabajador', 'Periodo', 'Total', 'Estado', 'Acciones']} emptyMessage="No hay cuentas registradas.">
              {filteredStatements.map((statement) => (
                <tr key={statement.id}>
                  <td className="px-4 py-3 font-bold text-primary">{statement.statementNumber || `#${statement.id}`}</td>
                  <td className="px-4 py-3 text-sm text-muted"><span className="block max-w-52 truncate" title={workerLabel(statement.worker, statement.collaborator)}>{workerLabel(statement.worker, statement.collaborator)}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{statement.periodStart.slice(0, 10)} al {statement.periodEnd.slice(0, 10)}</td>
                  <td className="px-4 py-3 font-bold text-primary">{formatCurrency(statement.totalAmount)}</td>
                  <td className="px-4 py-3 text-sm text-muted">{statement.status}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => void handleOpenStatementDetail(statement.id)} className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-base-color">Ver</button>{statement.status === 'PENDIENTE' ? <button type="button" onClick={() => void handleUpdateStatement(statement.id, 'ENVIADA')} className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-base-color">Enviar</button> : null}{statement.status === 'ENVIADA' ? <button type="button" onClick={() => void handleUpdateStatement(statement.id, 'PAGADA')} className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-600 hover:text-white">Pagar</button> : null}<button type="button" onClick={() => void handleDownloadPdf(statement.id)} className="rounded-lg border border-theme p-2 text-primary transition-colors hover:bg-primary hover:text-base-color"><Download className="h-4 w-4" /></button></div></td>
                </tr>
              ))}
            </Table>
          </TabsContent>

          <TabsContent value="history" className="p-6">
            <Table loading={loading} headers={['Trabajador', 'Cuentas', 'Facturado', 'Pagado', 'Saldo', 'Acciones']} emptyMessage="No hay historial para mostrar.">
              {historyRows.map((row) => (
                <tr key={row.workerId}>
                  <td className="px-4 py-3 font-bold text-primary"><span className="block max-w-52 truncate" title={row.name}>{row.name}</span></td>
                  <td className="px-4 py-3 text-sm text-muted">{row.statements}</td>
                  <td className="px-4 py-3 font-bold text-primary">{formatCurrency(row.billed)}</td>
                  <td className="px-4 py-3 font-bold text-primary">{formatCurrency(row.paid)}</td>
                  <td className="px-4 py-3 text-sm text-muted">{formatCurrency(row.billed - row.paid)}</td>
                  <td className="px-4 py-3"><div className="flex justify-end"><button type="button" onClick={() => void handleOpenWorkerHistory(row.workerId)} className="rounded-lg border border-theme px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-base-color">Ver detalle</button></div></td>
                </tr>
              ))}
            </Table>
          </TabsContent>
        </Tabs>
      </div>

      {workerModalOpen ? <Modal title={editingWorker ? 'Editar trabajador' : 'Nuevo trabajador'} onClose={() => setWorkerModalOpen(false)}><form onSubmit={handleSaveWorker} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Nombre</label><Input required value={workerForm.displayName} onChange={(event) => setWorkerForm((current) => ({ ...current, displayName: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Documento</label><Input required value={workerForm.documentNumber} onChange={(event) => setWorkerForm((current) => ({ ...current, documentNumber: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div><Field label="Tipo"><select value={workerForm.workerType} onChange={(event) => setWorkerForm((current) => ({ ...current, workerType: event.target.value as WorkerType }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary"><option value="EMPLOYEE">EMPLOYEE</option><option value="CONTRACTOR">CONTRACTOR</option><option value="TEMPORARY">TEMPORARY</option><option value="OTHER">OTHER</option></select></Field><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Valor hora</label><Input type="number" min="0" required value={workerForm.hourlyRate} onChange={(event) => setWorkerForm((current) => ({ ...current, hourlyRate: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div></div>{editingWorker ? <div className="rounded-2xl border border-theme bg-base/50 px-4 py-3 text-sm font-medium text-muted">Turnos abiertos del trabajador: {workerOpenShiftCounts[editingWorker.id] || 0}</div> : null}<div className="flex gap-3"><Button type="button" onClick={() => setWorkerModalOpen(false)} className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted">Cancelar</Button><Button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar trabajador'}</Button></div></form></Modal> : null}

      {shiftModalOpen ? <Modal title={editingShift ? 'Editar turno' : 'Nuevo turno'} onClose={() => setShiftModalOpen(false)} maxWidthClass="max-w-[35rem]"><form onSubmit={handleSaveShift} className="space-y-4"><div className="space-y-3.5"><Field label="Trabajador"><select required value={shiftForm.workerId} onChange={(event) => setShiftForm((current) => ({ ...current, workerId: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary"><option value="">Selecciona un trabajador</option>{workers.filter((worker) => worker.isActive || worker.id === editingShift?.workerId).map((worker) => <option key={worker.id} value={worker.id}>{worker.displayName} · {formatCurrency(worker.hourlyRate)}</option>)}</select></Field><div className="grid gap-3.5 md:grid-cols-2"><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Fecha</label><Input type="date" required value={shiftForm.workDate} onChange={(event) => setShiftForm((current) => ({ ...current, workDate: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Descanso (min)</label><Input type="number" min="0" value={shiftForm.breakMinutes} onChange={(event) => setShiftForm((current) => ({ ...current, breakMinutes: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div></div><div className="grid gap-3.5 md:grid-cols-2"><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Hora entrada</label><Input type="time" required value={shiftForm.startTime} onChange={(event) => setShiftForm((current) => ({ ...current, startTime: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div><div className="space-y-2"><label className="block text-[10px] font-black uppercase tracking-widest text-muted">Hora salida</label><Input type="time" required value={shiftForm.endTime} onChange={(event) => setShiftForm((current) => ({ ...current, endTime: event.target.value }))} className="w-full rounded-xl border border-theme bg-base px-4 py-3 text-sm font-bold" /></div></div><Field label="Observaciones"><textarea value={shiftForm.notes} onChange={(event) => setShiftForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-medium text-primary outline-none focus:ring-2 focus:ring-primary/20" /></Field><div className="grid gap-3.5 md:grid-cols-2"><PhotoUploadField label="Foto entrada" file={entryPhoto} inputId="payroll-entry-photo" onChange={setEntryPhoto} /><PhotoUploadField label="Foto salida" file={exitPhoto} inputId="payroll-exit-photo" onChange={setExitPhoto} /></div></div><div className="flex items-center justify-between rounded-2xl border border-theme bg-base/50 px-4 py-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted">Valor estimado del turno</span><span className="text-lg font-black text-primary">{formatCurrency(estimateShiftValue(shiftForm.startTime, shiftForm.endTime, Number(shiftForm.breakMinutes || 0), selectedWorker?.hourlyRate || 0))}</span></div><div className="flex gap-3"><Button type="button" onClick={() => setShiftModalOpen(false)} className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted">Cancelar</Button><Button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color">{saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Guardar turno'}</Button></div></form></Modal> : null}

      {shiftPhotosOpen && selectedShiftPhotos ? <Modal title={`Fotos del turno · ${workerLabel(selectedShiftPhotos.worker, selectedShiftPhotos.collaborator)}`} onClose={() => { setShiftPhotosOpen(false); setSelectedShiftPhotos(null); }} maxWidthClass="max-w-4xl"><div className="grid gap-4 md:grid-cols-2">{selectedShiftPhotos.entryPhotoUrl ? <div className="space-y-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted">Foto entrada</p><div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-theme bg-base/40"><Image src={selectedShiftPhotos.entryPhotoUrl} alt="Foto de entrada" fill className="object-cover" /></div></div> : <div className="rounded-2xl border border-dashed border-theme bg-base/30 p-6 text-sm font-medium text-muted">No hay foto de entrada.</div>}{selectedShiftPhotos.exitPhotoUrl ? <div className="space-y-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted">Foto salida</p><div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-theme bg-base/40"><Image src={selectedShiftPhotos.exitPhotoUrl} alt="Foto de salida" fill className="object-cover" /></div></div> : <div className="rounded-2xl border border-dashed border-theme bg-base/30 p-6 text-sm font-medium text-muted">No hay foto de salida.</div>}</div></Modal> : null}

      {statementDetailOpen && selectedStatement ? <Modal title={`Detalle cuenta ${selectedStatement.statementNumber || `#${selectedStatement.id}`}`} onClose={() => setStatementDetailOpen(false)}><div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Summary label="Trabajador" value={workerLabel(selectedStatement.worker, selectedStatement.collaborator)} /><Summary label="Estado" value={selectedStatement.status} /><Summary label="Total" value={formatCurrency(selectedStatement.totalAmount)} /></div><Table loading={false} headers={['Fecha', 'Horario', 'Valor hora', 'Total']} emptyMessage="Esta cuenta no tiene turnos asociados.">{(selectedStatement.shifts || []).map((shift) => <tr key={shift.id}><td className="px-4 py-3 text-sm text-muted">{shift.workDate.slice(0, 10)}</td><td className="px-4 py-3 text-sm text-muted"><div className="flex flex-col"><span>{shift.startTime} - {shift.endTime}</span><span className="text-[11px] font-bold text-primary/75">{formatWorkedHours(shift.startTime, shift.endTime, shift.breakMinutes)}</span></div></td><td className="px-4 py-3 text-sm text-muted">{formatCurrency(shift.hourlyRateApplied)}</td><td className="px-4 py-3 font-bold text-primary">{formatCurrency(shift.totalAmount)}</td></tr>)}</Table></div></Modal> : null}

      {workerHistoryOpen && selectedHistory ? <Modal title={`Historial de ${selectedHistory.displayName}`} onClose={() => setWorkerHistoryOpen(false)}><div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Summary label="Documento" value={selectedHistory.documentNumber} /><Summary label="Valor hora" value={formatCurrency(selectedHistory.hourlyRate)} /><Summary label="Estado" value={selectedHistory.isActive ? 'Activo' : 'Inactivo'} /></div><Table loading={false} headers={['Cuenta', 'Periodo', 'Estado', 'Total']} emptyMessage="Este trabajador no tiene cuentas de cobro.">{selectedHistory.billingStatements.map((statement) => <tr key={statement.id}><td className="px-4 py-3 font-bold text-primary">{statement.statementNumber || `#${statement.id}`}</td><td className="px-4 py-3 text-sm text-muted">{statement.periodStart.slice(0, 10)} al {statement.periodEnd.slice(0, 10)}</td><td className="px-4 py-3 text-sm text-muted">{statement.status}</td><td className="px-4 py-3 font-bold text-primary">{formatCurrency(statement.totalAmount)}</td></tr>)}</Table></div></Modal> : null}
    </div>
  );
}

function Table({ loading, headers, children, emptyMessage }: { loading: boolean; headers: string[]; children: ReactNode; emptyMessage: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return <div className="overflow-x-auto rounded-2xl border border-theme"><table className="w-full text-left"><thead className="bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/70"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-theme">{loading ? <tr><td colSpan={headers.length} className="px-6 py-12 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></td></tr> : hasRows ? children : <tr><td colSpan={headers.length} className="px-6 py-12 text-center text-sm italic text-muted">{emptyMessage}</td></tr>}</tbody></table></div>;
}

function Modal({ title, onClose, children, maxWidthClass = 'max-w-2xl' }: { title: string; onClose: () => void; children: ReactNode; maxWidthClass?: string }) {
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm" onClick={onClose}><div className={`w-full ${maxWidthClass} rounded-3xl border border-theme bg-surface p-6 shadow-2xl`} onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black text-primary">{title}</h2><button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-base"><X className="h-5 w-5" /></button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</label>{children}</div>;
}

function PhotoUploadField({ label, file, inputId, onChange }: { label: string; file: File | null; inputId: string; onChange: (file: File | null) => void }) {
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return <div className="space-y-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</label><div className="group relative rounded-2xl border-2 border-dashed border-theme bg-base/40 p-4 transition-colors hover:bg-base/70"><Input id={inputId} type="file" accept="image/*" className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" onChange={(event) => onChange(event.target.files?.[0] || null)} />{previewUrl ? <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl bg-slate-100"><Image src={previewUrl} alt={label} fill className="object-cover" unoptimized /><div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Cambiar foto</div></div> : <div className="flex aspect-[16/7] w-full flex-col items-center justify-center rounded-xl bg-base text-muted transition-colors group-hover:text-primary"><UploadCloud className="mb-2 h-6 w-6" /><span className="text-xs font-bold uppercase tracking-widest">Clic para subir foto</span><div className="mt-2 flex items-center gap-2 text-[11px] font-medium opacity-70"><Camera className="h-3.5 w-3.5" />JPG, PNG o WEBP</div></div>}</div></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-theme bg-base/50 px-4 py-3"><div className="text-[10px] font-black uppercase tracking-widest text-muted">{label}</div><div className="mt-2 text-sm font-bold text-primary">{value}</div></div>;
}
