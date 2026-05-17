import {
  DEFAULT_LANGUAGE_MODE,
  getSystemLocale,
  resolveLanguageMode,
  translate,
  type LanguageMode,
  type SupportedLocale,
  type Translate,
} from '@/lib/language';
import {
  loadLanguageMode,
  saveLanguageMode,
} from '@/lib/language-preference';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

type LanguageContextValue = {
  languageMode: LanguageMode;
  locale: SupportedLocale;
  systemLocale: string;
  setLanguageMode: (mode: LanguageMode) => Promise<void>;
  t: Translate;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [languageMode, setLanguageModeState] =
    useState<LanguageMode>(DEFAULT_LANGUAGE_MODE);
  const [systemLocale, setSystemLocale] = useState(() => getSystemLocale());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLanguageMode().then((mode) => {
      if (cancelled) return;
      setLanguageModeState(mode);
      setSystemLocale(getSystemLocale());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** 系统语言或 iOS「App 语言」变更后，回到前台时刷新跟随系统模式 */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setSystemLocale(getSystemLocale());
    });
    return () => sub.remove();
  }, []);

  const setLanguageMode = useCallback(async (mode: LanguageMode) => {
    setLanguageModeState(mode);
    setSystemLocale(getSystemLocale());
    await saveLanguageMode(mode);
  }, []);

  const locale = useMemo(
    () => resolveLanguageMode(languageMode, systemLocale),
    [languageMode, systemLocale]
  );

  const t = useCallback<Translate>(
    (key, values) => translate(locale, key, values),
    [locale]
  );

  const value = useMemo(
    () => ({
      languageMode,
      locale,
      systemLocale,
      setLanguageMode,
      t,
      ready,
    }),
    [languageMode, locale, systemLocale, setLanguageMode, t, ready]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
