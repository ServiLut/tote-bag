export const DEFAULT_LANGUAGE = 'es';
export const LANGUAGE_STORAGE_KEY = 'i18nextLng';
export const LANGUAGE_COOKIE_KEY = 'i18next';
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
