import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../domain/types';
import { translations } from '../infrastructure/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'de',
  setLanguage: () => {},
  t: (key: string, fallback?: string) => fallback || key,
});

const detectDeviceLanguage = (): Language => {
  if (typeof window !== 'undefined' && navigator) {
    const primary = (navigator.language || (navigator as any).userLanguage || '').toLowerCase();
    if (primary.startsWith('de')) return 'de';
    if (primary.startsWith('en')) return 'en';

    if (navigator.languages && navigator.languages.length > 0) {
      for (const lang of navigator.languages) {
        const lower = lang.toLowerCase();
        if (lower.startsWith('de')) return 'de';
        if (lower.startsWith('en')) return 'en';
      }
    }
  }
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'en' || saved === 'de') {
      return saved;
    }
    return detectDeviceLanguage();
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language];
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const deDict = translations['de'];
    if (deDict && deDict[key]) {
      return deDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
