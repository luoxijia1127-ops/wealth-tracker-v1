/**
 * OpenFIGI v3 搜索（无密钥，有频控）：联想美股 / 港股 / 英欧等，映射为 Stooq 符号。
 */

import { ENDPOINTS } from '@/lib/config/endpoints';
import {
  OPENFIGI_US_EXCH_CODES,
  buildIntlStooqSymbol,
  openfigiExchCodeToVenueAndSuffix,
  type IntlListingExchange,
} from '@/lib/intl-exchange-stooq';
import type { ChinaExchange, ListingExchange } from '@/types/asset';

export type IntlSuggestRow = {
  code: string;
  name: string;
  exchange: IntlListingExchange;
  intlQuoteSymbol: string;
  figi?: string;
  isin?: string;
};

/** OpenFIGI 对纯中文公司名常无结果，用英文关键词再搜一次 */
const FIGI_FALLBACK_QUERY: Record<string, string> = {
  腾讯: 'Tencent',
  tencent: 'Tencent',
  阿里巴巴: 'Alibaba',
  alibaba: 'Alibaba',
  美团: 'Meituan',
  京东: 'JD.com',
  百度: 'Baidu',
  网易: 'NetEase',
  小米: 'Xiaomi',
  比亚迪: 'BYD',
  中国移动: 'China Mobile',
  港交所: 'Hong Kong Exchanges',
};

/** 美股 ticker → Stooq，如 BRK.B → brk-b.us */
export function usTickerToStooq(ticker: string): string {
  return `${ticker.trim().toLowerCase().replace(/\./g, '-')}.us`;
}

/** 港股代码 → Stooq，如 0700 → 700.hk */
export function hkTickerToStooq(ticker: string): string {
  const digits = ticker.replace(/\D/g, '');
  const n = parseInt(digits || '0', 10);
  if (n > 0) return `${n}.hk`;
  return `${ticker.trim().toLowerCase()}.hk`;
}

type FigiRow = {
  ticker?: string;
  name?: string;
  exchCode?: string | null;
  securityType?: string;
  securityType2?: string;
  marketSector?: string;
  figi?: string;
  securityID?: string | null;
};

function parseIsinFromFigiRow(row: FigiRow): string | undefined {
  const sid =
    typeof row.securityID === 'string' ? row.securityID.trim().toUpperCase() : '';
  if (/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(sid)) return sid;
  return undefined;
}

function isValidFigiEquityTicker(tk: string): boolean {
  if (!tk || tk.includes(' ') || tk.includes('=') || tk.length > 20) return false;
  if (/\bIndex\b/i.test(tk)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9.\-]*$/.test(tk);
}

function passesFigiEquitySecurity(row: FigiRow, tk: string): boolean {
  const st = String(row.securityType ?? '');
  const st2 = String(row.securityType2 ?? '');
  const sector = String(row.marketSector ?? '');
  if (
    st === 'Common Stock' ||
    st === 'ETF' ||
    st === 'ETC' ||
    st === 'ETP' ||
    st === 'REIT' ||
    st.includes('Receipt') ||
    st.includes('ADR') ||
    st === 'Mutual Fund'
  ) {
    return isValidFigiEquityTicker(tk);
  }
  /** 实物商品线（英欧 ETC 等）在 OpenFIGI 上常见此描述，非期货合约 */
  if (
    /physical/i.test(st) &&
    /commodity|commodities/i.test(st) &&
    !st.includes('Future')
  ) {
    return isValidFigiEquityTicker(tk);
  }
  if (sector === 'Equity' && isValidFigiEquityTicker(tk)) {
    return true;
  }
  if (
    (st2 === 'ETF' || st2 === 'ETC' || st2 === 'ETP') &&
    isValidFigiEquityTicker(tk)
  ) {
    return true;
  }
  if (
    /\bETC\b/i.test(st) ||
    /\bETP\b/i.test(st) ||
    /\bETC\b/i.test(st2) ||
    /\bETP\b/i.test(st2)
  ) {
    return isValidFigiEquityTicker(tk);
  }
  return false;
}

/** OpenFIGI v3/search 不接受 maxResults 等字段，否则会返回 error、无 data */
function figiRowIntlVenue(row: FigiRow): IntlListingExchange | null {
  const ex = typeof row.exchCode === 'string' ? row.exchCode : '';
  const st = String(row.securityType ?? '');
  const st2 = String(row.securityType2 ?? '');
  const sector = String(row.marketSector ?? '');
  if (st.includes('Index') || st2 === 'Index' || sector === 'Index') {
    return null;
  }
  if (
    st.includes('Future') ||
    st.includes('Option') ||
    st.includes('Swap') ||
    st.includes('Warrant')
  ) {
    return null;
  }

  const tk = String(row.ticker ?? '').trim();
  if (!isValidFigiEquityTicker(tk)) return null;

  if (ex === 'HK') {
    if (st.includes('Index')) return null;
    return 'HK';
  }

  if (OPENFIGI_US_EXCH_CODES.has(ex)) {
    if (!passesFigiEquitySecurity(row, tk)) return null;
    return 'US';
  }

  const eu = openfigiExchCodeToVenueAndSuffix(ex);
  if (!eu) return null;
  if (!passesFigiEquitySecurity(row, tk)) return null;
  return eu.venue;
}

function figiRowScore(row: FigiRow, qRaw: string, qNorm: string): number {
  const ticker = String(row.ticker ?? '').trim();
  const base = ticker.replace(/\..*$/, '').toUpperCase();
  let s = 0;
  if (base === qNorm || ticker.toUpperCase() === qNorm) s += 120;
  else if (base.startsWith(qNorm) && qNorm.length >= 2) s += 40;
  const nm = String(row.name ?? '');
  if (qRaw.length >= 1 && nm.includes(qRaw)) s += 45;
  const nmU = nm.toUpperCase();
  if (qNorm.length >= 2 && nmU.includes(qNorm)) s += 15;
  if (row.securityType === 'Common Stock') s += 8;
  if (row.securityType === 'ETF') s += 5;
  if (row.securityType === 'ETC' || row.securityType2 === 'ETC') s += 5;
  if (row.securityType === 'ETP' || row.securityType2 === 'ETP') s += 4;
  return s;
}

async function fetchOpenFigiSearchRows(
  searchQuery: string,
  signal?: AbortSignal
): Promise<FigiRow[]> {
  const res = await fetch(ENDPOINTS.openfigiSearch, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Assetup/1.0',
    },
    body: JSON.stringify({ query: searchQuery }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: FigiRow[];
    error?: string;
  };
  if (typeof json.error === 'string' && json.error.length > 0) return [];
  return Array.isArray(json.data) ? json.data : [];
}

export async function searchOpenFigiIntl(
  query: string,
  signal?: AbortSignal
): Promise<IntlSuggestRow[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  try {
    const qLower = q.toLowerCase();
    const extraQuery =
      FIGI_FALLBACK_QUERY[q] ?? FIGI_FALLBACK_QUERY[qLower];

    let rows = await fetchOpenFigiSearchRows(q, signal);
    if (extraQuery && extraQuery !== q) {
      const more = await fetchOpenFigiSearchRows(extraQuery, signal);
      const rowKey = (r: FigiRow) =>
        `${r.ticker ?? ''}|${r.exchCode ?? ''}|${r.name ?? ''}`;
      const seen = new Set(rows.map(rowKey));
      for (const r of more) {
        const k = rowKey(r);
        if (!seen.has(k)) {
          seen.add(k);
          rows.push(r);
        }
      }
    }

    const qNorm = q.replace(/\s+/g, '').toUpperCase();
    const qDigits = q.replace(/\D/g, '');

    const candidates: { row: FigiRow; venue: IntlListingExchange; score: number }[] =
      [];
    for (const row of rows) {
      const ticker = typeof row.ticker === 'string' ? row.ticker.trim() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      if (!ticker || !name) continue;

      const venue = figiRowIntlVenue(row);
      if (!venue) continue;

      let score = figiRowScore(row, q, qNorm);
      if (venue === 'HK' && qDigits.length >= 3) {
        const d = ticker.replace(/\D/g, '');
        if (d.includes(qDigits) || qDigits.includes(d)) score += 25;
      }
      candidates.push({ row, venue, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const out: IntlSuggestRow[] = [];

    for (const { row, venue } of candidates) {
      const ticker = row.ticker!.trim();
      const name = row.name!.trim();
      const figiRaw = typeof row.figi === 'string' ? row.figi.trim().toUpperCase() : '';
      const figi =
        figiRaw.length >= 8 && figiRaw.length <= 14 && /^[A-Z0-9]+$/.test(figiRaw)
          ? figiRaw
          : undefined;
      const isin = parseIsinFromFigiRow(row);

      if (venue === 'HK') {
        const stooq = hkTickerToStooq(ticker);
        if (seen.has(stooq)) continue;
        seen.add(stooq);
        const code =
          /^[0-9]+$/.test(ticker) ? String(parseInt(ticker, 10)) : ticker;
        out.push({
          code,
          name,
          exchange: 'HK',
          intlQuoteSymbol: stooq,
          ...(figi ? { figi } : {}),
          ...(isin ? { isin } : {}),
        });
      } else if (venue === 'US') {
        const stooq = usTickerToStooq(ticker);
        if (seen.has(stooq)) continue;
        seen.add(stooq);
        out.push({
          code: ticker,
          name,
          exchange: 'US',
          intlQuoteSymbol: stooq,
          ...(figi ? { figi } : {}),
          ...(isin ? { isin } : {}),
        });
      } else {
        const ex = typeof row.exchCode === 'string' ? row.exchCode : '';
        const mapped = openfigiExchCodeToVenueAndSuffix(ex);
        if (!mapped) continue;
        const stooq = buildIntlStooqSymbol(ticker, mapped.stooqSuffix);
        if (seen.has(stooq)) continue;
        seen.add(stooq);
        out.push({
          code: ticker,
          name,
          exchange: mapped.venue,
          intlQuoteSymbol: stooq,
          ...(figi ? { figi } : {}),
          ...(isin ? { isin } : {}),
        });
      }
      if (out.length >= 14) break;
    }

    return out;
  } catch {
    return [];
  }
}

export type UnifiedSuggestItem = {
  code: string;
  name: string;
  exchange: ListingExchange;
  quoteId?: string;
  intlQuoteSymbol?: string;
  figi?: string;
  isin?: string;
};
