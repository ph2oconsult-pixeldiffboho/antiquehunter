import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import de from './de.json';
import zh from './zh.json';
import ja from './ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      zh: { translation: zh },
      ja: { translation: ja }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    parseMissingKeyHandler: (key: string) => {
      // Never render raw dotted or capitalized key strings
      const parts = key.split('.');
      const lastPart = parts[parts.length - 1] || key;
      return lastPart
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/^\w/, (c) => c.toUpperCase());
    }
  });

export default i18n;
