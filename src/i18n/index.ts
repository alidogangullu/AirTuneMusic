import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { createMMKV } from 'react-native-mmkv';
import { Platform, NativeModules } from 'react-native';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import { queryClient } from '../api/queryClient';

const storage = createMMKV({ id: 'i18n-storage' });
const LANGUAGE_KEY = 'app_language';

const SUPPORTED_LANGUAGES = ['en', 'tr', 'de', 'es', 'fr'];

const getDeviceLanguage = () => {
  if (Platform.OS === 'android') {
    const locale = 
      NativeModules.I18nManager?.localeIdentifier || 
      NativeModules.I18nManager?.getConstants?.()?.localeIdentifier;
    
    if (locale) {
      const lang = locale.split(/[_-]/)[0].toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return lang;
      }
    }
  }
  return null;
};

const languageDetector = {
  type: 'languageDetector' as const,
  async: false,
  detect: () => {
    const savedLanguage = storage.getString(LANGUAGE_KEY);
    if (savedLanguage) {
      return savedLanguage;
    }
    
    const deviceLanguage = getDeviceLanguage();
    if (deviceLanguage) {
      return deviceLanguage;
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
      de: { translation: de },
      es: { translation: es },
      fr: { translation: fr },
    },
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // React already docs escaping
    },
  });

export const changeLanguage = (lang: 'en' | 'tr' | 'de' | 'es' | 'fr') => {
  i18n.changeLanguage(lang);
};

i18n.on('languageChanged', () => {
  queryClient.clear();
});

export default i18n;
