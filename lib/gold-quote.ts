/**
 * 贵金属·金（XAU）人民币参考价（CNY/克）：
 * - 优先 EXPO_PUBLIC_GOLD_QUOTE_URL（GET, JSON）
 * - 其次东方财富上海金现货 AU9999（与上金所现货品种对应，非官方直连）
 * - 最后招商银行公开行情页（Au99.99）
 */

import { ENDPOINTS } from '@/lib/config/endpoints';
import { fetchSgeCnyPerGramFromEastmoney } from '@/lib/sge-eastmoney-quote';

function parseFlexiblePrice(data: unknown, depth = 0): number | null {
  if (depth > 4) return null;
  if (typeof data === 'number' && data > 0 && data < 5000) return data;
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  const keys = ['price', 'Price', 'last', 'close', 'sell', 'mid', 'bid'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && v > 0 && v < 5000) return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.trim().replace(/,/g, ''));
      if (!Number.isNaN(n) && n > 0 && n < 5000) return n;
    }
  }
  if (o.data !== undefined) {
    const inner = parseFlexiblePrice(o.data, depth + 1);
    if (inner !== null) return inner;
  }
  return null;
}

function readConfiguredGoldUrl(): string {
  try {
    const u =
      typeof process !== 'undefined' &&
      process.env &&
      typeof process.env.EXPO_PUBLIC_GOLD_QUOTE_URL === 'string'
        ? process.env.EXPO_PUBLIC_GOLD_QUOTE_URL.trim()
        : '';
    return u;
  } catch {
    return '';
  }
}

function parseCmbAu9999Price(text: string): number | null {
  const normalized = text.replace(/\s+/g, ' ');
  const m = normalized.match(/Au99\.99[^0-9]{1,40}([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return null;
  const p = parseFloat(m[1]);
  if (!Number.isNaN(p) && p > 0 && p < 5000) return p;
  return null;
}

async function fetchCmbGoldQuote(
  signal?: AbortSignal
): Promise<{ price: number; source: string } | null> {
  try {
    const r = await fetch(ENDPOINTS.cmbGoldRateHtml, {
      signal,
    });
    if (!r.ok) return null;
    const t = await r.text();
    const p = parseCmbAu9999Price(t);
    if (p !== null) return { price: p, source: 'cmb-mobile-web-au99.99' };
  } catch {
    return null;
  }
  return null;
}

export async function fetchGoldReferenceCnyPerGram(
  signal?: AbortSignal
): Promise<{ price: number; source?: string } | null> {
  const url = readConfiguredGoldUrl();
  if (url) {
    try {
      const r = await fetch(url, {
        signal,
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const j: unknown = await r.json();
        const p = parseFlexiblePrice(j);
        if (p !== null && p > 0) {
          return { price: p, source: 'EXPO_PUBLIC_GOLD_QUOTE_URL' };
        }
      }
    } catch {
      // ignore and fallback
    }
  }
  const sge = await fetchSgeCnyPerGramFromEastmoney('XAU', signal);
  if (sge) return sge;
  return fetchCmbGoldQuote(signal);
}
