/**
 * East Money web suggest API (prototype)。
 * 含 A 股 / 场内基金 / 北交所，以及场外开放式基金（OTCFUND，secid 2.xxxxxx）。
 */

import { EASTMONEY_SUGGEST_TOKEN } from '@/lib/eastmoney-config';
import { exchangeFromQuoteId } from '@/lib/eastmoney-secid';
import {
  INTL_EXCHANGE_LABEL_ZH,
  isIntlListingExchange,
} from '@/lib/intl-exchange-stooq';
import type { ChinaExchange, ListingExchange } from '@/types/asset';

import { ENDPOINTS } from '@/lib/config/endpoints';

const SUGGEST_URL = ENDPOINTS.eastmoneySuggest;

export type SuggestInstrument = {
  code: string;
  name: string;
  exchange: ChinaExchange | 'SGE';
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

  /** 上金现货：须先于六位数字 Code 解析（合约含字母，Code 可能不全） */
  const quoteIdSge = String(raw.QuoteID ?? '').trim();
  if (/^118\./.test(quoteIdSge)) {
    const tail = quoteIdSge.slice(4).trim();
    if (tail.length < 2) return null;
    const nm = String(raw.Name ?? '').trim();
    if (!nm) return null;
    return { code: tail, name: nm, exchange: 'SGE', quoteId: quoteIdSge };
  }

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

/** 上金联想：原样 / 大写 / 去空格等多路请求，合并去重并做本地相关度排序（小写、简称更友好） */
export function sgeSearchQueryVariants(raw: string): string[] {
  const t = raw.trim();
  if (t.length < 1) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const x = s.trim();
    if (x.length > 0 && !out.includes(x)) out.push(x);
  };
  push(t);
  const upper = t.toUpperCase();
  if (upper !== t) push(upper);
  const lower = t.toLowerCase();
  if (lower !== t && lower !== upper) push(lower);
  const compact = t.replace(/\s/g, '');
  if (compact !== t) {
    push(compact);
    const cup = compact.toUpperCase();
    if (cup !== compact) push(cup);
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 3 && digits !== t && !out.includes(digits)) {
    push(digits);
  }
  return out.slice(0, 6);
}

function scoreSgeMatch(item: SuggestInstrument, qRaw: string): number {
  const q = qRaw.trim().toLowerCase();
  if (q.length < 1) return 0;
  const code = item.code.toLowerCase();
  const name = item.name.toLowerCase();
  let s = 0;
  if (code === q) s += 100;
  else if (code.startsWith(q)) s += 45;
  else if (code.includes(q)) s += 28;
  if (name.includes(q)) s += 18;
  const qd = q.replace(/\D/g, '');
  const cd = code.replace(/\D/g, '');
  if (qd.length >= 2 && cd.includes(qd)) s += 22;
  return s;
}

export async function searchSgeSecuritiesMerged(
  query: string,
  signal?: AbortSignal
): Promise<SuggestInstrument[]> {
  const variants = sgeSearchQueryVariants(query);
  if (variants.length === 0) return [];
  const lists = await Promise.all(
    variants.map((v) => searchSecurities(v, signal))
  );
  const seen = new Set<string>();
  const merged: SuggestInstrument[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (item.exchange !== 'SGE') continue;
      const k = item.quoteId;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(item);
    }
  }
  const q0 = query.trim();
  merged.sort((a, b) => scoreSgeMatch(b, q0) - scoreSgeMatch(a, q0));
  return merged;
}

/** 展示：交易所前缀 + 代码；场外 / 国际 / 上金现货 */
export function formatExchangeSymbol(
  exchange: ListingExchange,
  code: string
): string {
  if (exchange === 'OTC') return `场外·${code}`;
  if (isIntlListingExchange(exchange)) {
    const label = INTL_EXCHANGE_LABEL_ZH[exchange];
    return `${label}·${code}`;
  }
  if (exchange === 'SGE') return `上金·${code}`;
  return `${exchange}${code}`;
}
