import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createMMKV } from 'react-native-mmkv';
import en from '../locales/en.json';
import tr from '../locales/tr.json';

const storage = createMMKV({ id: 'i18n-storage' });
const LANGUAGE_KEY = 'app_language';

const languageDetector = {
  type: 'languageDetector' as const,
  async: false,
  detect: () => {
    const savedLanguage = storage.getString(LANGUAGE_KEY);
    if (savedLanguage) {
      return savedLanguage;
    }
    // Default to English
    return 'en';
  },
  init: () => {},
  cacheUserLanguage: (language: string) => {
    storage.set(LANGUAGE_KEY, language);
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already docs escaping
    },
  });

export const changeLanguage = (lang: 'en' | 'tr') => {
  i18n.changeLanguage(lang);
};

export default i18n;
