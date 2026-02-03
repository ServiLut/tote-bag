'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Image from 'next/image';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setError('Debes aceptar los términos y condiciones');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, acceptTerms }),
      });

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(responseBody.message || 'Error al registrarse');
      }

      const result = responseBody.data;
      setSuccess(result.message);
      
      if (!result.requiresEmailVerification) {
          setEmail('');
          setPassword('');
          setAcceptTerms(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al registrarse';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Left: Decorative Image */}
      <div className="hidden lg:block w-1/2 bg-secondary/10 relative overflow-hidden">
        <Image
          src="/tote_bag_lifestyle.png"
          alt="Tote Bag Workshop"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/5 z-10" />
        <div className="absolute bottom-12 left-12 right-12 z-20 text-[#111111]">
          <h2 className="text-4xl font-serif font-bold mb-4">Empieza tu viaje sostenible.</h2>
          <p className="text-lg opacity-80 font-medium">Crea una cuenta para realizar seguimiento de tus pedidos y acceder a ofertas especiales.</p>
        </div>
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="absolute top-8 left-8">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted hover:text-primary transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Volver a la tienda
          </Link>
        </div>

        <div className="w-full max-w-md space-y-10">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl font-serif font-bold text-body tracking-tight">
              Crear Cuenta
            </h1>
            <p className="mt-3 text-muted text-lg">
              Regístrate en segundos y únete a nosotros.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-100">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-sm text-green-700 border border-green-100">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold">¡Registro Exitoso!</p>
                <p className="mt-1">{success}</p>
                <Link href="/login" className="block mt-2 font-bold underline hover:text-green-900">
                  Ir a Iniciar Sesión
                </Link>
              </div>
            </div>
          )}

          {!success && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-body">Correo electrónico</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-xl border border-theme bg-base py-3.5 pl-11 pr-4 text-body placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      placeholder="nombre@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-body">Contraseña</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-xl border border-theme bg-base py-3.5 pl-11 pr-4 text-body placeholder:text-muted/70 focus:border-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex items-start pt-2">
                  <div className="flex items-center h-5">
                    <input
                      id="terms"
                      name="terms"
                      type="checkbox"
                      required
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="w-4 h-4 border border-theme rounded bg-base text-primary focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="terms" className="font-medium text-muted">
                      Acepto la <Link href="/legal/privacy" className="text-primary hover:underline">Política de Privacidad</Link> y el <Link href="/legal/data-processing" className="text-primary hover:underline">Tratamiento de Datos Personales</Link>.
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-4 text-sm font-bold text-base-color uppercase tracking-widest hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </button>
            </form>
          )}

          <div className="text-center pt-4">
            <p className="text-muted">
              ¿Ya tienes una cuenta?{' '}
              <Link
                href="/login"
                className="font-bold text-primary hover:underline"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
