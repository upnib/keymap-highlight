// i18n/index.ts - Configures i18next with browser language detection and the six supported
// locale bundles (en, zh-CN, zh-TW, es, ja, fr). Detection order prefers localStorage, then
// the browser navigator, then the HTML lang attribute. Falls back to English when unresolved.
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import zhTW from '../locales/zh-TW.json';

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zh },
  'zh-TW': { translation: zhTW },
  es: { translation: es },
  ja: { translation: ja },
  fr: { translation: fr },
};

void i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  supportedLngs: ['en', 'zh-CN', 'zh-TW', 'es', 'ja', 'fr'],
  fallbackLng: 'en',
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
