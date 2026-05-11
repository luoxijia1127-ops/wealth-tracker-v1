import type { SupportedLocale } from '@/lib/language';

/**
 * 托管法律页（如 `docs/privacy.html`、`docs/terms.html`）使用 `id="zh"` / `id="en"`
 * 区分中英文区块。为 URL 设置对应 hash，便于 WebView 打开时直接滚到当前应用语言段落。
 */
export function applyLegalPageLocaleHash(url: string, locale: SupportedLocale): string {
  try {
    const u = new URL(url);
    u.hash = locale === 'en-US' ? 'en' : 'zh';
    return u.toString();
  } catch {
    return url;
  }
}
