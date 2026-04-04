/**
 * Stooq 延迟行情（CSV，无密钥）：美股 `aapl.us`、港股 `700.hk` 等。
 * 大陆网络通常可访问；与 OpenFIGI 联想配合使用。
 */

import { buildStooqCsvUrl } from '@/lib/config/endpoints';

const STOOQ_UA =
  'Mozilla/5.0 (compatible; WealthTracker/1.0; +https://stooq.com)';

export type StooqQuoteRow = {
  close: number;
  /** YYYY-MM-DD */
  tradeDate: string;
};

function parseStooqCsvLine(line: string): StooqQuoteRow | null {
  const cols = line.split(',');
  if (cols.length < 7) return null;
  const date = cols[1]!.trim();
  if (date === 'N/D' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const close = parseFloat(cols[6]!);
  if (!Number.isFinite(close) || close <= 0) return null;
  return { close, tradeDate: date };
}

export async function fetchStooqQuote(
  intlQuoteSymbol: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const sym = intlQuoteSymbol.trim().toLowerCase();
  if (!/^[a-z0-9.\-]+\.(us|hk)$/.test(sym)) return null;

  const url = buildStooqCsvUrl(sym);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    return parseStooqCsvLine(lines[1]!);
  } catch {
    return null;
  }
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
      headers: {
        Accept: 'text/csv,*/*',
        'User-Agent': STOOQ_UA,
      },
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
export async function fetchStooqCloseOnOrBefore(
  intlQuoteSymbol: string,
  asOfYmd: string,
  signal?: AbortSignal
): Promise<StooqQuoteRow | null> {
  const sym = intlQuoteSymbol.trim().toLowerCase();
  if (!/^[a-z0-9.\-]+\.(us|hk)$/.test(sym)) return null;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
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
