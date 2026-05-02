/**
 * App → 自建 Vercel 代理（Twelve Data）。不在客户端携带 Twelve API Key。
 */

import { ENDPOINTS } from '@/lib/config/endpoints';
import { fetchWithTimeout } from '@/lib/net/fetch-with-timeout';
import { isTwelveIntlProviderEnabled } from '@/lib/intl-provider';

function proxyBaseUrl(): string | null {
  const o = ENDPOINTS.marketProxyOrigin?.trim();
  if (!o) return null;
  return o.replace(/\/$/, '');
}

function proxyHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  try {
    const s = process.env.EXPO_PUBLIC_MARKET_PROXY_SECRET?.trim();
    if (s) h['x-assetup-proxy-secret'] = s;
  } catch {
    /* ignore */
  }
  return h;
}

export type TwelveSymbolSearchRow = {
  symbol?: string;
  instrument_name?: string;
  mic_code?: string;
  exchange?: string;
  country?: string;
  currency?: string;
  instrument_type?: string;
};

type TwelveSearchResponse = {
  data?: TwelveSymbolSearchRow[];
  status?: string;
};

export async function fetchTwelveSymbolSearchViaProxy(
  q: string,
  signal?: AbortSignal,
  limit = 14
): Promise<TwelveSymbolSearchRow[]> {
  if (!isTwelveIntlProviderEnabled()) return [];
  const base = proxyBaseUrl();
  if (!base) return [];

  const url = `${base}/api/market/search?${new URLSearchParams({
    q: q.trim(),
    limit: String(limit),
  }).toString()}`;

  const res = await fetchWithTimeout(url, {
    parentSignal: signal,
    timeoutMs: 8000,
    headers: proxyHeaders(),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as TwelveSearchResponse;
  if (json.status && json.status !== 'ok') return [];
  return Array.isArray(json.data) ? json.data : [];
}

export type TwelveQuoteOk = {
  ok: true;
  close: number;
  tradeDate: string | null;
  currency: string | null;
  symbol: string;
  mic_code: string;
  source: string;
};

export type TwelveQuoteFail = { ok: false; reason?: string };

export async function fetchTwelveQuoteViaProxy(
  symbol: string,
  mic: string,
  signal?: AbortSignal,
  asOfYmd?: string
): Promise<TwelveQuoteOk | TwelveQuoteFail> {
  if (!isTwelveIntlProviderEnabled()) return { ok: false, reason: 'disabled' };
  const base = proxyBaseUrl();
  if (!base) return { ok: false, reason: 'no_proxy' };

  const params = new URLSearchParams({
    symbol: symbol.trim(),
    mic: mic.trim().toUpperCase(),
  });
  const td = asOfYmd?.trim();
  if (td && /^\d{4}-\d{2}-\d{2}$/.test(td)) params.set('asOf', td);

  const url = `${base}/api/market/quote?${params.toString()}`;
  const res = await fetchWithTimeout(url, {
    parentSignal: signal,
    timeoutMs: 8000,
    headers: proxyHeaders(),
  });
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  const json = (await res.json()) as TwelveQuoteOk | TwelveQuoteFail;
  if (!json || typeof json !== 'object') return { ok: false, reason: 'bad_json' };
  if (!('ok' in json) || json.ok !== true) {
    return { ok: false, reason: 'ok' in json ? (json as TwelveQuoteFail).reason : 'fail' };
  }
  const j = json as TwelveQuoteOk;
  if (!Number.isFinite(j.close) || j.close <= 0) return { ok: false, reason: 'no_close' };
  return j;
}
