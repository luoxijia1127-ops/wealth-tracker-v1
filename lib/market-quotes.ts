/**
 * 全球指数与外汇：优先 Stooq 即时 CSV（q/l）单行解析；A 股主要指数走东方财富日 K（Stooq 常无数据）。
 *
 * 注意：Stooq 对部分常用写法（如 ^ixic、^n225、^ftse、ethusd）返回 N/D，需使用其站内可用的别名（见各条 symbol）。
 */

import { buildStooqCsvUrl, ENDPOINTS } from '@/lib/config/endpoints';
import { EASTMONEY_UT } from '@/lib/eastmoney-config';
import { parseKlineLast } from '@/lib/eastmoney-kline';
import { Ionicons } from '@expo/vector-icons';

export type MarketItemDef = {
  id: string;
  /** 展示名 */
  name: string;
  /** Stooq 代码（小写），用于非东财条目 */
  symbol: string;
  /** 行左侧线性图标（与增加资产表单 Ionicons outline 一致） */
  icon: keyof typeof Ionicons.glyphMap;
  /** 东方财富 secid（如上证 1.000001）；有则优先拉日 K，失败再试 Stooq */
  eastmoneySecid?: string;
};

export type MarketSectionDef = {
  key: string;
  title: string;
  items: MarketItemDef[];
};

/** 与参考 UI 接近的分组；符号以 Stooq / 东财为准 */
export const MARKET_SECTIONS: MarketSectionDef[] = [
  {
    key: 'us',
    title: '美股',
    items: [
      /** Stooq 上 ^ixic 常为 N/D；^ndq 有即时合成指数据 */
      { id: 'ixic', name: '纳斯达克', symbol: '^ndq', icon: 'pulse-outline' },
      { id: 'spx', name: '标普 500', symbol: '^spx', icon: 'stats-chart-outline' },
      { id: 'dji', name: '道琼斯', symbol: '^dji', icon: 'bar-chart-outline' },
    ],
  },
  {
    key: 'asia',
    title: '亚太',
    items: [
      {
        id: 'sse',
        name: '上证指数',
        symbol: '000001.sh',
        icon: 'trending-up-outline',
        eastmoneySecid: '1.000001',
      },
      {
        id: 'szse',
        name: '深证成指',
        symbol: '399001.sz',
        icon: 'layers-outline',
        eastmoneySecid: '0.399001',
      },
      { id: 'hsi', name: '恒生指数', symbol: '^hsi', icon: 'business-outline' },
      /** ^n225 常为 N/D；^nkx 为日经 225 在 Stooq 的可用代码 */
      { id: 'n225', name: '日经 225', symbol: '^nkx', icon: 'speedometer-outline' },
      /** Stooq：^kospi */
      { id: 'kospi', name: '韩国综合', symbol: '^kospi', icon: 'flag-outline' },
    ],
  },
  {
    key: 'eu',
    title: '欧美',
    items: [
      { id: 'ftse', name: '英国富时 100', symbol: '^ukx', icon: 'pie-chart-outline' },
      { id: 'gdaxi', name: '德国 DAX', symbol: '^dax', icon: 'analytics-outline' },
      { id: 'fchi', name: '法国 CAC40', symbol: '^cac', icon: 'earth-outline' },
    ],
  },
  {
    key: 'fx',
    title: '汇率',
    items: [
      { id: 'usdcny', name: '美元/人民币', symbol: 'usdcny', icon: 'cash-outline' },
      { id: 'hkdcny', name: '港元/人民币', symbol: 'hkdcny', icon: 'wallet-outline' },
      { id: 'eurcny', name: '欧元/人民币', symbol: 'eurcny', icon: 'swap-horizontal-outline' },
      { id: 'jpycny', name: '日元/人民币', symbol: 'jpycny', icon: 'repeat-outline' },
    ],
  },
  {
    key: 'major',
    title: '其他',
    items: [
      { id: 'btc', name: '比特币', symbol: 'btcusd', icon: 'disc-outline' },
      /** ethusd 在 Stooq q/l 常为 N/D；eth.v 为美元计价 ETH 现货序列 */
      { id: 'eth', name: '以太坊', symbol: 'eth.v', icon: 'infinite-outline' },
      { id: 'xau', name: '贵金属·金', symbol: 'xauusd', icon: 'diamond-outline' },
      { id: 'xag', name: '贵金属·银', symbol: 'xagusd', icon: 'triangle-outline' },
    ],
  },
];

export type MarketQuoteResult = {
  def: MarketItemDef;
  price: number | null;
  /**
   * 涨跌%：东财指数为最近两根日 K 收盘对比；
   * Stooq 为 (收盘−开盘)/开盘（延迟一行，近似当日波动）；无有效数据为 null。
   */
  changePct: number | null;
  asOfDate: string | null;
};

const STOOQ_UA =
  'Mozilla/5.0 (compatible; Assetup/1.0; +https://stooq.com)';

/** Stooq q/l：Symbol,Date,Time,Open,High,Low,Close,Volume */
function parseStooqIntradayLine(line: string): {
  tradeDate: string;
  open: number | null;
  close: number;
} | null {
  const cols = line.split(',');
  if (cols.length < 7) return null;
  const date = cols[1]!.trim();
  if (date === 'N/D' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const openRaw = cols[3]!.trim();
  const open =
    openRaw === 'N/D' || openRaw === ''
      ? null
      : (() => {
          const v = parseFloat(openRaw);
          return Number.isFinite(v) && v > 0 ? v : null;
        })();
  const close = parseFloat(cols[6]!);
  if (!Number.isFinite(close) || close <= 0) return null;
  return { tradeDate: date, open, close };
}

async function fetchStooqLatestRow(
  symbol: string,
  signal?: AbortSignal
): Promise<{
  tradeDate: string;
  open: number | null;
  close: number;
} | null> {
  const sym = symbol.trim().toLowerCase();
  const url = buildStooqCsvUrl(sym);
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
  return parseStooqIntradayLine(lines[1]!);
}

async function fetchEastmoneyIndexDaily(
  secid: string,
  signal?: AbortSignal
): Promise<{
  price: number;
  changePct: number | null;
  asOfDate: string;
} | null> {
  const params = new URLSearchParams({
    secid,
    ut: EASTMONEY_UT,
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    klt: '101',
    fqt: '1',
    end: '20500101',
    lmt: '40',
  });
  const url = `${ENDPOINTS.eastmoneyKline}?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    rc?: number;
    data?: { klines?: string[] };
  };
  if (json.rc !== undefined && json.rc !== 0) return null;
  const klines = json.data?.klines;
  if (!klines?.length) return null;
  const bars: { close: number; tradeDate: string }[] = [];
  for (const k of klines) {
    const p = parseKlineLast(k);
    if (p) bars.push(p);
  }
  if (bars.length === 0) return null;
  bars.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  const last = bars[bars.length - 1]!;
  const prev = bars.length >= 2 ? bars[bars.length - 2]! : null;
  const changePct =
    prev && prev.close > 0
      ? ((last.close - prev.close) / prev.close) * 100
      : null;
  return {
    price: last.close,
    changePct,
    asOfDate: last.tradeDate,
  };
}

export async function fetchMarketQuote(
  def: MarketItemDef,
  signal?: AbortSignal
): Promise<MarketQuoteResult> {
  try {
    if (def.eastmoneySecid) {
      const em = await fetchEastmoneyIndexDaily(def.eastmoneySecid, signal);
      if (em) {
        return {
          def,
          price: em.price,
          changePct: em.changePct,
          asOfDate: em.asOfDate,
        };
      }
    }

    const row = await fetchStooqLatestRow(def.symbol, signal);
    if (!row) {
      return { def, price: null, changePct: null, asOfDate: null };
    }
    const changePct =
      row.open !== null && row.open > 0
        ? ((row.close - row.open) / row.open) * 100
        : null;
    return {
      def,
      price: row.close,
      changePct,
      asOfDate: row.tradeDate,
    };
  } catch {
    return { def, price: null, changePct: null, asOfDate: null };
  }
}

/** 并行拉取所有条目（分块减轻服务端压力）；支持外部 AbortSignal 提前结束。 */
export async function fetchAllMarketQuotes(
  onChunk?: (partial: MarketQuoteResult[]) => void,
  signal?: AbortSignal
): Promise<MarketQuoteResult[]> {
  const flat = MARKET_SECTIONS.flatMap((s) => s.items);
  const chunkSize = 5;
  const out: MarketQuoteResult[] = [];
  for (let i = 0; i < flat.length; i += chunkSize) {
    if (signal?.aborted) break;
    const chunk = flat.slice(i, i + chunkSize);
    const part = await Promise.all(
      chunk.map((def) => fetchMarketQuote(def, signal))
    );
    out.push(...part);
    if (signal?.aborted) break;
    onChunk?.([...out]);
  }
  return out;
}
