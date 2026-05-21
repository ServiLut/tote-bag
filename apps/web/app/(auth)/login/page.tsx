'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { apiFetch } from '@/utils/api';
import { createClient } from '@/utils/supabase/client';
import { getDashboardDebugRoleHeader } from '@/utils/supabase/auth';
import { resolvePostLoginRedirectPath } from '@/lib/frontend-routing';
import {
  extractRoleFromProfilePayload,
  type DashboardRole,
} from '@/lib/dashboard-auth';

type LoginPayload = {
  session?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
  role?: DashboardRole | null;
};

async function parseJsonSafely(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function loginAgainstApi(email: string, password: string) {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const body = await parseJsonSafely(response);

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : `Login failed with status ${response.status}`;

    throw new Error(message);
  }

  const payload =
    body &&
    typeof body === 'object' &&
    'data' in body &&
    body.data &&
    typeof body.data === 'object'
      ? (body.data as LoginPayload)
      : (body as LoginPayload | null);

  if (!payload?.session?.access_token || !payload?.session?.refresh_token) {
    throw new Error('No se recibio una sesion valida.');
  }

  return payload;
}

async function resolveRoleFromApi(accessToken: string) {
  try {
    const response = await apiFetch('/profiles/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(await getDashboardDebugRoleHeader()),
      },
    });

    if (!response.ok) {
      return null;
    }

    const body = await parseJsonSafely(response);
    return extractRoleFromProfilePayload(body);
  } catch {
    return null;
  }
}

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        throw new Error('Ingresa correo y contrasena.');
      }

      const payload = await loginAgainstApi(normalizedEmail, password);
      const session = payload.session;
      let role = payload.role ?? null;

      if (!session?.access_token || !session.refresh_token) {
        throw new Error(
          'No se recibio una sesion valida. Verifica tus credenciales e intenta de nuevo.',
        );
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (sessionError) {
        throw sessionError;
      }

      if (!role) {
        role = await resolveRoleFromApi(session.access_token);
      }

      if (role) {
        window.localStorage.setItem('user_role', role);
      } else {
        window.localStorage.removeItem('user_role');
      }

      const redirectPath = resolvePostLoginRedirectPath({
        role,
        requestedRedirect: searchParams.get('redirect'),
      });

      window.location.replace(redirectPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesion';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-surface">
      <div className="relative hidden w-1/2 overflow-hidden bg-secondary/10 lg:block">
        <Image
          src="/tote_bag_lifestyle.png"
          alt="Tote Bag Lifestyle"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 z-10 bg-black/5" />
        <div className="absolute bottom-12 left-12 right-12 z-20 text-[#111111]">
          <h2 className="mb-4 text-4xl font-serif font-bold">
            Lleva tu estilo a todas partes.
          </h2>
          <p className="text-lg font-medium opacity-80">
            Unete a nuestra comunidad y disfruta de beneficios exclusivos en tu
            proxima compra.
          </p>
        </div>
      </div>

      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="absolute left-8 top-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la tienda
          </Link>
        </div>

        <div className="w-full max-w-md space-y-10">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-serif font-bold tracking-tight text-body">
              Bienvenido
            </h1>
            <p className="mt-3 text-lg text-muted">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          {error ? (
            <div className="flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-body">
                  Correo electronico
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border border-theme bg-base py-3.5 pl-11 pr-4 text-body placeholder:text-muted/70 transition-all focus:border-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-body">
                    Contrasena
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted hover:text-primary hover:underline"
                  >
                    Olvidaste tu contrasena?
                  </Link>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border border-theme bg-base py-3.5 pl-11 pr-4 text-body placeholder:text-muted/70 transition-all focus:border-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Ingresa tu contrasena"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-sm font-bold uppercase tracking-widest text-base-color shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesion...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <div className="pt-4 text-center">
            <p className="text-muted">
              No tienes cuenta?{' '}
              <Link href="/register" className="font-bold text-primary hover:underline">
                Registrate ahora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginPageContent />
    </Suspense>
  );
}
