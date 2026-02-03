"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { cn } from "@/utils/cn";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      const consent = localStorage.getItem("cookie-consent");
      if (!consent) {
        setIsVisible(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isMounted) return null;

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setIsVisible(false);
  };

  const declineCookies = () => {
    localStorage.setItem("cookie-consent", "declined");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6",
        "bg-surface border-t border-theme shadow-lg",
        "flex flex-col md:flex-row items-center justify-between gap-4",
        "transition-all duration-300 ease-in-out"
      )}
    >
      <div className="flex items-start md:items-center gap-4 flex-1">
        <div className="p-2 bg-primary/10 rounded-full shrink-0">
          <Cookie className="w-6 h-6 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-body">Aviso de Cookies</h3>
          <p className="text-sm text-muted">
            Utilizamos cookies propias y de terceros para mejorar tu experiencia de usuario,
            analizar el tráfico y personalizar el contenido. Al continuar navegando,
            aceptas nuestra <Link href="/legal/cookies" className="underline hover:text-primary">política de cookies</Link> y el uso de datos según nuestra <Link href="/legal/privacy" className="underline hover:text-primary">política de privacidad</Link>.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
        <button
          onClick={declineCookies}
          className="px-4 py-2 text-sm font-medium text-muted hover:text-body transition-colors"
        >
          Rechazar
        </button>
        <button
          onClick={acceptCookies}
          className="px-6 py-2 text-sm font-medium bg-primary text-base-color rounded-md hover:opacity-90 transition-opacity"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}
