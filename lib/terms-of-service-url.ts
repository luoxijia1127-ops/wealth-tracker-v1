/**
 * 托管用户协议页 URL（构建时由 EXPO_PUBLIC_TERMS_OF_SERVICE_URL 注入）。
 * 英文界面可选用 EXPO_PUBLIC_TERMS_OF_SERVICE_URL_EN（未配置则回退到默认 URL）。
 */

import type { SupportedLocale } from '@/lib/language';

function readHttpUrlFromEnv(name: string): string | null {
  try {
    const v = process.env[name];
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (t.length === 0) return null;
    if (!/^https?:\/\//i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}

export function getTermsOfServiceUrl(): string | null {
  return readHttpUrlFromEnv('EXPO_PUBLIC_TERMS_OF_SERVICE_URL');
}

export function getTermsOfServiceUrlForLocale(locale: SupportedLocale): string | null {
  if (locale === 'en-US') {
    const en = readHttpUrlFromEnv('EXPO_PUBLIC_TERMS_OF_SERVICE_URL_EN');
    if (en) return en;
  }
  return getTermsOfServiceUrl();
}
