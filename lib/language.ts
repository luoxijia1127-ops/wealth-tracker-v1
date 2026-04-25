import { zhCN } from '@/lib/translations/zh-CN';
import { enUS } from '@/lib/translations/en-US';

export type SupportedLocale = 'zh-CN' | 'en-US';
export type LanguageMode = 'system' | SupportedLocale;
export type TranslationKey = keyof typeof zhCN;
export type TranslationValues = Record<string, string | number>;
export type Translate = (
  key: TranslationKey,
  values?: TranslationValues
) => string;

const dictionaries: Record<SupportedLocale, Record<TranslationKey, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const DEFAULT_LANGUAGE_MODE: LanguageMode = 'system';

export function isLanguageMode(value: string): value is LanguageMode {
  return value === 'system' || value === 'zh-CN' || value === 'en-US';
}

export function resolveSystemLocale(systemLocale = getSystemLocale()): SupportedLocale {
  return systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function resolveLanguageMode(
  mode: LanguageMode,
  systemLocale?: string
): SupportedLocale {
  return mode === 'system' ? resolveSystemLocale(systemLocale) : mode;
}

export function getSystemLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch {
    return 'en-US';
  }
}

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  values?: TranslationValues
): string {
  const template = dictionaries[locale][key] ?? dictionaries['zh-CN'][key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
