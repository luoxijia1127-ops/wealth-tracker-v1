/**
 * 托管用户协议页 URL（构建时由 EXPO_PUBLIC_TERMS_OF_SERVICE_URL 注入）。
 */

export function getTermsOfServiceUrl(): string | null {
  try {
    const v = process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (t.length === 0) return null;
    if (!/^https?:\/\//i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}
