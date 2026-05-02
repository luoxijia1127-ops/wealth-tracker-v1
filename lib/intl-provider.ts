/**
 * 国际行情提供方：Twelve Data（经 Vercel 代理）或 legacy（OpenFIGI + Stooq）。
 *
 * 由构建时环境变量控制；未配置代理或显式 legacy 时走旧链路，保证离线开发与不配代理的安装包仍可运行。
 */

export function isTwelveIntlProviderEnabled(): boolean {
  try {
    if (process.env.EXPO_PUBLIC_INTL_PROVIDER === 'legacy') return false;
    const o = process.env.EXPO_PUBLIC_MARKET_PROXY_ORIGIN;
    return typeof o === 'string' && o.trim().length > 0;
  } catch {
    return false;
  }
}

/** 联想缓存键前缀：切换 provider 后避免命中旧缓存 */
export function intlProviderCacheKeyPrefix(): 'td|' | 'lg|' {
  return isTwelveIntlProviderEnabled() ? 'td|' : 'lg|';
}

/** 参考价 / 刷新：Twelve 失败后再打 Stooq（默认关，省流量与双计费） */
export function isIntlStooqFallbackEnabled(): boolean {
  try {
    return process.env.EXPO_PUBLIC_INTL_PRICE_FALLBACK_STOOQ === 'true';
  } catch {
    return false;
  }
}
