'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Headset, Loader2, MessageSquareText } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { useTranslation } from 'react-i18next';

const fieldClassName =
  'h-14 w-full rounded-2xl border border-theme bg-surface px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-primary/20';

const textAreaClassName =
  'min-h-[10.5rem] w-full rounded-2xl border border-theme bg-surface px-4 py-3 font-medium outline-none focus:ring-2 focus:ring-primary/20';

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

export default function PqrsPage() {
  const { t } = useTranslation();
  const pqrsOptions = [
    { value: 'PETICION', label: t('pqrs_option_petition') },
    { value: 'QUEJA', label: t('pqrs_option_complaint') },
    { value: 'RECLAMO', label: t('pqrs_option_claim') },
    { value: 'SUGERENCIA', label: t('pqrs_option_suggestion') },
  ];
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    type: 'PETICION',
    subject: '',
    message: '',
    orderNumber: '',
  });

  const helperText = useMemo(() => {
    const labels = {
      PETICION: t('pqrs_helper_petition'),
      QUEJA: t('pqrs_helper_complaint'),
      RECLAMO: t('pqrs_helper_claim'),
      SUGERENCIA: t('pqrs_helper_suggestion'),
    };

    return labels[form.type as keyof typeof labels];
  }, [form.type, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitting(true);

    try {
      const payload = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        type: form.type,
        subject: form.subject.trim(),
        message: form.message.trim(),
        orderNumber: form.orderNumber.trim() || undefined,
      };

      if (payload.fullName.length < 3) {
        throw new Error(t('pqrs_full_name'));
      }

      if (payload.subject.length < 4) {
        throw new Error(t('pqrs_subject'));
      }

      if (payload.message.length < 10) {
        throw new Error(t('pqrs_message'));
      }

      const response = await apiFetch('/pqrs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, t('pqrs_submit_error')));
      }

      setSubmitted(true);
      setForm({
        fullName: '',
        email: '',
        phone: '',
        type: 'PETICION',
        subject: '',
        message: '',
        orderNumber: '',
      });
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : t('pqrs_submit_error_retry'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-base px-4 py-12 md:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <section className="grid gap-8 rounded-[2rem] border border-theme bg-surface p-8 shadow-sm lg:grid-cols-[0.95fr_1.05fr] lg:p-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full bg-primary px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-base-color">
              <Headset className="h-4 w-4" />
              {t('pqrs_badge')}
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-primary md:text-5xl">{t('pqrs_title')}</h1>
              <p className="max-w-xl text-base font-medium leading-7 text-muted">{t('pqrs_description')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard title={t('pqrs_response_time_title')} description={t('pqrs_response_time_description')} />
              <InfoCard title={t('pqrs_traceable_title')} description={t('pqrs_traceable_description')} />
            </div>

            {submitted ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-black">{t('pqrs_success_title')}</p>
                  <p className="text-sm font-medium">{t('pqrs_success_description')}</p>
                </div>
              </div>
            ) : null}

            {submitError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
                {submitError}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.75rem] border border-theme bg-base/40 p-6 shadow-inner md:p-8">
            <div className="mb-6">
              <h2 className="flex items-center gap-3 text-2xl font-black text-primary">
                <MessageSquareText className="h-6 w-6" />
                {t('pqrs_send_title')}
              </h2>
              <p className="mt-2 text-sm font-medium text-muted">{helperText}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t('pqrs_full_name')}>
                  <input required minLength={3} maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={fieldClassName} />
                </FormField>
                <FormField label={t('pqrs_email')}>
                  <input type="email" required maxLength={160} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={fieldClassName} />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t('pqrs_phone')}>
                  <input maxLength={40} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={fieldClassName} />
                </FormField>
                <FormField label={t('pqrs_order_number')}>
                  <input maxLength={40} value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))} className={fieldClassName} />
                </FormField>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.65fr_1.35fr]">
                <FormField label={t('pqrs_request_type')}>
                  <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className={fieldClassName}>
                    {pqrsOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label={t('pqrs_subject')}>
                  <input required minLength={4} maxLength={160} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} className={fieldClassName} />
                </FormField>
              </div>

              <FormField label={t('pqrs_message')}>
                <textarea required rows={7} minLength={10} maxLength={2000} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} className={textAreaClassName} />
              </FormField>

              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-black uppercase tracking-wider text-base-color shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                {submitting ? t('pqrs_sending') : t('pqrs_send')}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-theme bg-base/30 p-5">
      <p className="text-sm font-black text-primary">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-muted">{description}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex h-full flex-col gap-2">
      <span className="text-[11px] font-black uppercase leading-4 tracking-[0.18em] text-muted md:min-h-[2rem]">
        {label}
      </span>
      {children}
    </label>
  );
}
