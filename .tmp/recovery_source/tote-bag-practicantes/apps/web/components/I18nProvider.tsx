'use client';

import '../lib/i18n';
import React from 'react';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
