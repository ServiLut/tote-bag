import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../public/locales/en/common.json';
import esCommon from '../public/locales/es/common.json';

export const DEFAULT_LANGUAGE = 'es';
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';
export const LANGUAGE_COOKIE_KEY = 'i18next';
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    common: enCommon,
  },
  es: {
    common: esCommon,
  },
};

const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage => {
  if (!value) {
    return false;
  }

  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
};

const normalizeLanguage = (value: string | null | undefined): SupportedLanguage | null => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.toLowerCase().split('-')[0];
  return isSupportedLanguage(normalizedValue) ? normalizedValue : null;
};

export const resolveClientLanguage = (): SupportedLanguage => {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const storedLanguage = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  if (storedLanguage) {
    return storedLanguage;
  }

  const cookieLanguage = normalizeLanguage(
    window.document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${LANGUAGE_COOKIE_KEY}=`))
      ?.split('=')[1],
  );
  if (cookieLanguage) {
    return cookieLanguage;
  }

  const htmlLanguage = normalizeLanguage(window.document.documentElement.lang);
  if (htmlLanguage) {
    return htmlLanguage;
  }

  const browserLanguage = normalizeLanguage(window.navigator.language);
  return browserLanguage ?? DEFAULT_LANGUAGE;
};

export const persistLanguage = (language: string) => {
  const normalizedLanguage = normalizeLanguage(language) ?? DEFAULT_LANGUAGE;

  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
  window.document.cookie = `${LANGUAGE_COOKIE_KEY}=${normalizedLanguage}; path=/; max-age=31536000; SameSite=Lax`;
  window.document.documentElement.lang = normalizedLanguage;
};

const i18nInstance = i18n;

if (!i18nInstance.isInitialized) {
  i18nInstance
    .use(initReactI18next)
    .init({
      resources,
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false, // react already safes from xss
      },
    });
}

export default i18nInstance;
