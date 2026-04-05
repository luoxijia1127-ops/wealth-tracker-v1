/**
 * 托管隐私政策页 URL（构建时由 EXPO_PUBLIC_PRIVACY_POLICY_URL 注入）。
 * 仅支持 http(s)，供应用内 WebView 加载。
 */

export function getPrivacyPolicyUrl(): string | null {
  try {
    const v = process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL;
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (t.length === 0) return null;
    if (!/^https?:\/\//i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}
