/**
 * East Money web suggest API (prototype)。
 * 含 A 股 / 场内基金 / 北交所，以及场外开放式基金（OTCFUND，secid 2.xxxxxx）。
 */

import { EASTMONEY_SUGGEST_TOKEN } from '@/lib/eastmoney-config';
import { exchangeFromQuoteId } from '@/lib/eastmoney-secid';
import type { ChinaExchange, ListingExchange } from '@/types/asset';

const SUGGEST_URL = 'https://searchadapter.eastmoney.com/api/suggest/get';

export type SuggestInstrument = {
  code: string;
  name: string;
  exchange: ChinaExchange;
  quoteId: string;
};

type RawRow = Record<string, unknown>;

function normalizeCode(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\D/g, '');
  if (s.length === 0) return null;
  const padded = s.length <= 6 ? s.padStart(6, '0') : s.slice(0, 6);
  return /^\d{6}$/.test(padded) ? padded : null;
}

/**
 * 仅保留可用 push2 / push2his 拉行情的标的：
 * - 场内：QuoteID 0.xxx / 1.xxx
 * - 场外开放式基金：Classify OTCFUND，QuoteID 多为 150.xxxxxx（缺省时用 150+Code）
 */
export function parseSuggestRow(raw: RawRow): SuggestInstrument | null {
  const classify = String(raw.Classify ?? '');
  if (classify === 'Index') return null;

  const code = normalizeCode(raw.Code);
  if (!code) return null;

  const name = String(raw.Name ?? '').trim();
  if (!name) return null;

  if (classify === 'OTCFUND') {
    const rid = String(raw.QuoteID ?? '').trim();
    const quoteId = /^\d+\.\d+$/.test(rid) ? rid : `150.${code}`;
    return { code, name, exchange: 'OTC', quoteId };
  }

  const quoteId = String(raw.QuoteID ?? '');
  if (!/^(0|1)\.\d+/.test(quoteId)) return null;

  const stName = String(raw.SecurityTypeName ?? '');
  let exchange: ChinaExchange;
  if (classify === 'NEEQ' || stName.includes('京')) {
    exchange = 'BJ';
  } else {
    exchange = exchangeFromQuoteId(quoteId);
  }

  return { code, name, exchange, quoteId };
}

export async function searchSecurities(
  query: string,
  signal?: AbortSignal
): Promise<SuggestInstrument[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const params = new URLSearchParams({
    input: q,
    type: '14',
    token: EASTMONEY_SUGGEST_TOKEN,
    count: '12',
  });

  const res = await fetch(`${SUGGEST_URL}?${params.toString()}`, {
    signal,
  });
  if (!res.ok) return [];

  const json = (await res.json()) as {
    QuotationCodeTable?: { Data?: RawRow[] };
  };
  const rows = json.QuotationCodeTable?.Data;
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();
  const out: SuggestInstrument[] = [];
  for (const row of rows) {
    const item = parseSuggestRow(row);
    if (!item) continue;
    const key = `${item.exchange}:${item.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** 展示：交易所前缀 + 代码；场外 / 美股 / 港股 */
export function formatExchangeSymbol(
  exchange: ListingExchange,
  code: string
): string {
  if (exchange === 'OTC') return `场外·${code}`;
  if (exchange === 'US') return `US·${code}`;
  if (exchange === 'HK') return `HK·${code}`;
  return `${exchange}${code}`;
}
