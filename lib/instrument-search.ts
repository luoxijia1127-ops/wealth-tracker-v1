/**
 * 统一联想：东财（A 股 / 场外基金）+ OpenFIGI（美股 / 港股 / 英欧等）+ Stooq 代码探测（如 AAPL）。
 */

import { searchSecurities } from '@/lib/eastmoney-suggest';
import {
  hkTickerToStooq,
  searchOpenFigiIntl,
  usTickerToStooq,
  type IntlSuggestRow,
  type UnifiedSuggestItem,
} from '@/lib/openfigi-search';
import { fetchStooqQuote } from '@/lib/stooq-quote';

export type { UnifiedSuggestItem } from '@/lib/openfigi-search';

/** 常见中文/英文名 → 港股代码（OpenFIGI 联想常被期货占满，用 Stooq 校验） */
const KNOWN_HK_CODE: Record<string, string> = {
  腾讯: '700',
  tencent: '700',
  阿里巴巴: '9988',
  alibaba: '9988',
  美团: '3690',
  meituan: '3690',
  小米: '1810',
  xiaomi: '1810',
  京东: '9618',
  百度: '9888',
  网易: '9999',
  比亚迪: '1211',
};

/** Stooq 能拉到收盘价则视为有效美股/港股代码（绕过 OpenFIGI 前 100 条被指数占满的问题） */
async function stooqLookupHints(
  query: string,
  signal?: AbortSignal
): Promise<IntlSuggestRow[]> {
  const t = query.trim();
  const out: IntlSuggestRow[] = [];
  const seenStooq = new Set<string>();

  const pushHk = async (codeStr: string, displayName: string) => {
    const st = hkTickerToStooq(codeStr);
    if (seenStooq.has(st)) return;
    const row = await fetchStooqQuote(st, signal);
    if (!row) return;
    seenStooq.add(st);
    const n = parseInt(codeStr.replace(/\D/g, ''), 10);
    out.push({
      code: String(n),
      name: displayName,
      exchange: 'HK',
      intlQuoteSymbol: st,
    });
  };

  const hkKnown =
    KNOWN_HK_CODE[t] ?? KNOWN_HK_CODE[t.toLowerCase()];
  if (hkKnown) {
    await pushHk(hkKnown, `${t === '腾讯' || t.toLowerCase() === 'tencent' ? '腾讯控股' : t}（港股 ${hkKnown}）`);
  }

  const usLike = t.replace(/\s+/g, '');
  if (/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(usLike)) {
    const st = usTickerToStooq(usLike);
    if (!seenStooq.has(st)) {
      const row = await fetchStooqQuote(st, signal);
      if (row) {
        seenStooq.add(st);
        out.push({
          code: usLike.toUpperCase().replace(/\./g, '-'),
          name: `${usLike.toUpperCase()}（美股）`,
          exchange: 'US',
          intlQuoteSymbol: st,
        });
      }
    }
  }

  const hkDigits = t.replace(/\D/g, '');
  if (/^\d{4,5}$/.test(hkDigits)) {
    await pushHk(hkDigits, `港股 ${parseInt(hkDigits, 10)}`);
  }

  return out;
}

function dedupeIntlRows(a: IntlSuggestRow[], b: IntlSuggestRow[]): IntlSuggestRow[] {
  const seen = new Set<string>();
  const out: IntlSuggestRow[] = [];
  for (const x of [...a, ...b]) {
    const k = x.intlQuoteSymbol.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export async function searchUnifiedInstruments(
  query: string,
  signal?: AbortSignal
): Promise<UnifiedSuggestItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const [em, figiIntl, stooqIntl] = await Promise.all([
    searchSecurities(q, signal),
    searchOpenFigiIntl(q, signal),
    stooqLookupHints(q, signal),
  ]);

  const mergedIntl = dedupeIntlRows(stooqIntl, figiIntl);

  const out: UnifiedSuggestItem[] = [];
  for (const e of em) {
    out.push({
      code: e.code,
      name: e.name,
      exchange: e.exchange,
      quoteId: e.quoteId,
    });
  }
  for (const r of mergedIntl) {
    out.push({
      code: r.code,
      name: r.name,
      exchange: r.exchange,
      intlQuoteSymbol: r.intlQuoteSymbol,
      ...(r.figi ? { figi: r.figi } : {}),
      ...(r.isin ? { isin: r.isin } : {}),
    });
  }
  return out;
}
