'use client';

import React from 'react';
import { useEffect } from 'react';
import i18n, { persistLanguage, resolveClientLanguage } from '../lib/i18n';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    persistLanguage(i18n.resolvedLanguage || i18n.language);

    const syncLanguage = (language: string) => {
      persistLanguage(language);
    };

    i18n.on('languageChanged', syncLanguage);

    const clientLanguage = resolveClientLanguage();
    if (clientLanguage !== (i18n.resolvedLanguage || i18n.language)) {
      void i18n.changeLanguage(clientLanguage);
    }

    return () => {
      i18n.off('languageChanged', syncLanguage);
    };
  }, []);

  return <>{children}</>;
}
