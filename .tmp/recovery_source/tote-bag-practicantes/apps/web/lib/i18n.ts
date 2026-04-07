import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../public/locales/en/common.json';
import esCommon from '../public/locales/es/common.json';

const resources = {
  en: {
    common: enCommon,
  },
  es: {
    common: esCommon,
  },
};

const isClient = typeof window !== 'undefined';

const i18nInstance = i18n;

if (isClient) {
  i18nInstance.use(LanguageDetector);
}

i18nInstance
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'es',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    ...(isClient ? {
      detection: {
        order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
        caches: ['localStorage', 'cookie'],
      },
    } : {}),
  });

export default i18nInstance;
