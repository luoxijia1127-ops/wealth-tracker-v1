/**
 * 市场大盘：价格与涨跌幅展示（与 app/market.tsx 口径一致）
 */

import type { MarketQuoteResult } from '@/lib/market-quotes';

export function formatMarketPrice(q: MarketQuoteResult): string {
  const price = q.price;
  if (price === null || !Number.isFinite(price)) return '—';
  const sym = q.def.symbol;
  const isFx =
    sym.includes('usd') ||
    sym.includes('eur') ||
    sym.includes('jpy') ||
    sym.includes('hkd') ||
    sym.includes('rub') ||
    sym.includes('cny');
  if (isFx && price < 200) return price.toFixed(4);
  if (price >= 10000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  if (price >= 1000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 3 });
  }
  return price.toFixed(3);
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
