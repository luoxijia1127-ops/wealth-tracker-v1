/**
 * Stooq 延迟行情（CSV，无密钥）：美股 `aapl.us`、港股 `700.hk`、英欧 `vod.l` 等。
 * 大陆网络通常可访问；与 OpenFIGI 联想配合使用。
 *
 * 部分 LSE 标的（尤其 ETC）在 Stooq 上 `*.l` 的 `q/l` 常为全表 N/D，而同标的 `*.uk` 有有效行；
 * 拉价时对 `.l`/`.uk` 做互为回退。其余在 `q/l` 无效时仍尝试日 K（若站点要求 apikey 则可能失败）。
 */

import { buildStooqCsvUrl } from '@/lib/config/endpoints';
import { addCalendarDaysToShanghaiYmd, getShanghaiDateString } from '@/lib/date-shanghai';
import { isValidIntlStooqQuoteSymbol } from '@/lib/intl-exchange-stooq';

const STOOQ_UA =
  'Mozilla/5.0 (compatible; Assetup/1.0; +https://stooq.com)';

const STOOQ_CSV_HEADERS = {
  Accept: 'text/csv,*/*',
  'User-Agent': STOOQ_UA,
} as const;

export type StooqQuoteRow = {
  close: number;
  /** YYYY-MM-DD */
  tradeDate: string;
};

function stripBom(raw: string): string {
  return raw.replace(/^\uFEFF/, '');
}

/** 拆成非空行（跳过 UTF-8 BOM、空行；避免 q/l 第二行为空时整段解析失败） */
function splitStooqCsvLines(text: string): string[] {
  return stripBom(text)
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseStooqCsvLine(line: string): StooqQuoteRow | null {
  const cols = line.split(',');
  if (cols.length < 7) return null;
  const date = cols[1]!.trim();
  if (date === 'N/D' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const close = parseFloat(cols[6]!);
  if (!Number.isFinite(close) || close <= 0) return null;
  return { close, tradeDate: date };
}

/** 跳过表头后第一条可解析数据行 */
function firstStooqDataRow(text: string): StooqQuoteRow | null {
  const lines = splitStooqCsvLines(text);
  for (let i = 1; i < lines.length; i++) {
    const row = parseStooqCsvLine(lines[i]!);
    if (row) return row;
  }
  return null;
}

/**
 * 日 K CSV 中取「时间上最后一条」有效收盘（表头后按行序递增，取末条）。
 * 若响应过大（无 d1/d2 时），只扫尾部若干行以控内存。
 */
function lastStooqDataRowInLines(lines: string[], maxTailScan: number): StooqQuoteRow | null {
  if (lines.length < 2) return null;
  const start = Math.max(1, lines.length - maxTailScan);
  let best: StooqQuoteRow | null = null;
  for (let i = start; i < lines.length; i++) {
    const row = parseStooqCsvLine(lines[i]!);
    if (row) best = row;
  }
  return best;
}

/** 同一标的在 Stooq 上可能对应 `.l` 或 `.uk`；拉价时依次尝试（不改变用户保存的 intlQuoteSymbol）。 */
export function intlStooqPriceFallbackAliases(primary: string): string[] {
  const s = primary.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (x: string): void => {
    const t = x.trim().toLowerCase();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(s);
  if (s.endsWith('.l')) {
    add(`${s.slice(0, -2)}.uk`);
  } else if (s.endsWith('.uk')) {
    add(`${s.slice(0, -3)}.l`);
  }
  return out;
}

/**
 * `q/d/l` 最近约 140 个上海日历日的日 K（d1/d2 为 YYYYMMDD）；用于 q/l 即时行 N/D 时的回退。
 */
async function fetchStooqLatestDailyBar(
  sym: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const today = getShanghaiDateString();
  const start = addCalendarDaysToShanghaiYmd(today, -140);
  const d1 = start.replace(/-/g, '');
  const d2 = today.replace(/-/g, '');
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d&d1=${d1}&d2=${d2}`;
  try {
    const res = await fetch(url, {
      signal,
      headers: STOOQ_CSV_HEADERS,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = splitStooqCsvLines(text);
    const tail = lines.length > 900 ? 900 : lines.length;
    return lastStooqDataRowInLines(lines, tail);
  } catch {
    return null;
  }
}

async function fetchStooqQuoteForSymbolOnce(
  sym: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const url = buildStooqCsvUrl(sym);
  try {
    const res = await fetch(url, {
      signal,
      headers: STOOQ_CSV_HEADERS,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const fromQl = firstStooqDataRow(text);
    if (fromQl) return fromQl;
  } catch {
    /* 继续尝试日 K */
  }
  return fetchStooqLatestDailyBar(sym, signal);
}

export async function fetchStooqQuote(
  intlQuoteSymbol: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  for (const sym of intlStooqPriceFallbackAliases(intlQuoteSymbol)) {
    if (!isValidIntlStooqQuoteSymbol(sym)) continue;
    const row = await fetchStooqQuoteForSymbolOnce(sym, signal);
    if (row) return row;
  }
  return null;
}

/** Stooq q/l 单行：外汇/贵金属即期（如 xauusd、xagusd），Close 为 USD/金衡盎司 */
function parseStooqSpotLine(line: string): StooqQuoteRow | null {
  return parseStooqCsvLine(line);
}

/**
 * Stooq 延迟外汇/贵金属即期（小写符号）：如 `xauusd`、`xagusd`、`xptusd`、`xpdusd`。
 * 贵金属报价为美元/金衡盎司。
 */
export async function fetchStooqForexSpotLatest(
  stooqSymbol: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const sym = stooqSymbol.trim().toLowerCase();
  if (!/^[a-z]{6,12}$/.test(sym)) return null;
  const url = buildStooqCsvUrl(sym);
  try {
    const res = await fetch(url, {
      signal,
      headers: { ...STOOQ_CSV_HEADERS },
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length < 2) return null;
    return parseStooqSpotLine(lines[1]!);
  } catch {
    return null;
  }
}

/**
 * 日 K 历史 CSV：取「最后一根 tradeDate ≤ asOfYmd」的收盘（与 add-asset 成本回填一致）。
 */
async function fetchStooqCloseOnOrBeforeOne(
  sym: string,
  asOfYmd: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`;
  try {
    const res = await fetch(url, {
      signal,
      headers: STOOQ_CSV_HEADERS,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = splitStooqCsvLines(text);
    const rows: StooqQuoteRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseStooqCsvLine(lines[i]!);
      if (row) rows.push(row);
    }
    if (rows.length === 0) return null;
    rows.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
    let best: StooqQuoteRow | null = null;
    for (const r of rows) {
      if (r.tradeDate <= asOfYmd) best = r;
    }
    return best;
  } catch {
    return null;
  }
}

export async function fetchStooqCloseOnOrBefore(
  intlQuoteSymbol: string,
  asOfYmd: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const td = asOfYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) return null;
  for (const sym of intlStooqPriceFallbackAliases(intlQuoteSymbol)) {
    if (!isValidIntlStooqQuoteSymbol(sym)) continue;
    const row = await fetchStooqCloseOnOrBeforeOne(sym, td, signal);
    if (row) return row;
  }
  return null;
}
