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
import {
  buildIntlStooqSymbol,
  isValidIntlStooqQuoteSymbol,
  type IntlListingExchange,
} from '@/lib/intl-exchange-stooq';
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

/** Stooq 后缀 → 本 App 交易所（与 intl-exchange-stooq 白名单一致） */
const STOOQ_SUFFIX_VENUE: Record<string, IntlListingExchange> = {
  us: 'US',
  hk: 'HK',
  l: 'LSE',
  uk: 'LSE',
  de: 'XETR',
  pa: 'XPAR',
  as: 'XAMS',
  sw: 'XSWX',
  mi: 'XMIL',
  mc: 'BMEX',
  br: 'XAMS',
  st: 'XSTO',
  ol: 'XOSL',
  co: 'XCSE',
  he: 'XHEL',
  i: 'XDUB',
};

/**
 * 纯字母 ticker 在 Stooq 上探测顺序：英股优先，再常见欧陆后缀。
 * 列表保持完整以记录覆盖范围，但运行时只取前 EU_STOOQ_PROBE_LIMIT 个并行探测；
 * 弱网下避免 14 跳串行把联想拖到 4-5 秒。
 */
const EU_STOOQ_PROBE: { suffix: string; venue: IntlListingExchange }[] = [
  { suffix: 'l', venue: 'LSE' },
  { suffix: 'uk', venue: 'LSE' },
  { suffix: 'de', venue: 'XETR' },
  { suffix: 'pa', venue: 'XPAR' },
  { suffix: 'as', venue: 'XAMS' },
  { suffix: 'sw', venue: 'XSWX' },
  { suffix: 'mi', venue: 'XMIL' },
  { suffix: 'mc', venue: 'BMEX' },
  { suffix: 'br', venue: 'XAMS' },
  { suffix: 'st', venue: 'XSTO' },
  { suffix: 'ol', venue: 'XOSL' },
  { suffix: 'co', venue: 'XCSE' },
  { suffix: 'he', venue: 'XHEL' },
  { suffix: 'i', venue: 'XDUB' },
];

/** 联想阶段 EU 后缀并行上限；命中按优先级取第一个 */
const EU_STOOQ_PROBE_LIMIT = 4;

/** Stooq 能拉到收盘价则视为有效代码（绕过 OpenFIGI 排序/条数限制；含英欧显式后缀与 .l 探测） */
async function stooqLookupHints(
  query: string,
  signal?: AbortSignal
): Promise<IntlSuggestRow[]> {
  const t = query.trim();
  const compact = t.replace(/\s+/g, '');
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

  const explicit = /^([A-Za-z0-9][A-Za-z0-9.\-]{0,15})\.(US|UK|HK|L|DE|PA|AS|SW|MI|MC|BR|ST|OL|CO|HE|I)$/i.exec(
    compact
  );
  if (explicit) {
    const base = explicit[1]!;
    const suf = explicit[2]!.toLowerCase();
    const st = buildIntlStooqSymbol(base, suf);
    const venue = STOOQ_SUFFIX_VENUE[suf];
    if (venue && isValidIntlStooqQuoteSymbol(st) && !seenStooq.has(st)) {
      const row = await fetchStooqQuote(st, signal);
      if (row) {
        seenStooq.add(st);
        const codeDisp = base.replace(/\./g, '-').toUpperCase();
        out.push({
          code: codeDisp,
          name: codeDisp,
          exchange: venue,
          intlQuoteSymbol: st,
        });
      }
    }
  }

  const hkKnown =
    KNOWN_HK_CODE[t] ?? KNOWN_HK_CODE[t.toLowerCase()];
  if (hkKnown) {
    await pushHk(
      hkKnown,
      t === '腾讯' || t.toLowerCase() === 'tencent' ? '腾讯控股' : t
    );
  }

  const hkDigits = t.replace(/\D/g, '');
  if (/^\d{4,5}$/.test(hkDigits)) {
    await pushHk(hkDigits, String(parseInt(hkDigits, 10)));
  }

  if (/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/.test(compact)) {
    const st = usTickerToStooq(compact);
    if (!seenStooq.has(st)) {
      const row = await fetchStooqQuote(st, signal);
      if (row) {
        seenStooq.add(st);
        out.push({
          code: compact.toUpperCase().replace(/\./g, '-'),
          name: compact.toUpperCase().replace(/\./g, '-'),
          exchange: 'US',
          intlQuoteSymbol: st,
        });
      }
    }
  }

  if (/^[A-Za-z]{2,5}$/.test(compact)) {
    const usSym = usTickerToStooq(compact);
    if (!seenStooq.has(usSym)) {
      const probes = EU_STOOQ_PROBE.slice(0, EU_STOOQ_PROBE_LIMIT)
        .map((p) => ({
          ...p,
          stooq: buildIntlStooqSymbol(compact, p.suffix),
        }))
        .filter((p) => !seenStooq.has(p.stooq));

      const probeResults = await Promise.all(
        probes.map((p) =>
          fetchStooqQuote(p.stooq, signal).then((row) => ({ p, row }))
        )
      );
      /** 按 EU_STOOQ_PROBE 顺序（即 probes 顺序）取首个有效行情，保留原"英股优先"语义 */
      const hit = probeResults.find((r) => r.row !== null);
      if (hit) {
        const { suffix: _suffix, venue, stooq: st } = hit.p;
        seenStooq.add(st);
        const codeDisp = compact.toUpperCase();
        out.push({
          code: codeDisp,
          name: codeDisp,
          exchange: venue,
          intlQuoteSymbol: st,
        });
      }
    }
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

  /** OpenFIGI 在前：避免短 ticker 的 Stooq 美股探测（如 BATS→bats.us）盖住用户更可能要的英欧联想 */
  const mergedIntl = dedupeIntlRows(figiIntl, stooqIntl);

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
