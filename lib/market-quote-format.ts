/**
 * 市场大盘：价格与涨跌幅展示（与 app/market.tsx 口径一致）
 *
 * 价格：汇率类 4 位小数；指数 / 贵金属 / 加密等均为四舍五入整数（千分位分隔）。
 */

import type { MarketQuoteResult } from '@/lib/market-quotes';

/** 与 `MARKET_SECTIONS` 中「汇率」条目 symbol 一致（小写） */
const FX_4DP_SYMBOLS = new Set([
  'usdcny',
  'hkdcny',
  'eurcny',
  'jpycny',
]);

export function formatMarketPrice(q: MarketQuoteResult): string {
  const price = q.price;
  if (price === null || !Number.isFinite(price)) return '—';
  const sym = q.def.symbol.trim().toLowerCase();

  if (FX_4DP_SYMBOLS.has(sym)) {
    return price.toFixed(4);
  }

  const rounded = Math.round(price);
  if (Math.abs(rounded) >= 10_000) {
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  return String(rounded);
}

export function formatMarketPct(q: MarketQuoteResult): string {
  const c = q.changePct;
  if (c === null || !Number.isFinite(c)) return '—';
  const sign = c > 0 ? '+' : '';
  return `${sign}${c.toFixed(2)}%`;
}

export function marketPctColor(
  q: MarketQuoteResult,
  colors: { muted: string; rise: string; fall: string }
): string {
  const c = q.changePct;
  if (c === null || !Number.isFinite(c)) return colors.muted;
  if (c > 0) return colors.rise;
  if (c < 0) return colors.fall;
  return colors.muted;
}
