/**
 * 市场大盘行情本地缓存：进入页面只读缓存快速展示，下拉刷新时再拉网并回写。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MARKET_SECTIONS,
  type MarketItemDef,
  type MarketQuoteResult,
} from '@/lib/market-quotes';

const STORAGE_KEY = '@nest/market-quotes-cache-v1';

type CachedRow = {
  id: string;
  price: number | null;
  changePct: number | null;
  asOfDate: string | null;
};

type CachedPayload = {
  v: 1;
  savedAt: number;
  rows: CachedRow[];
};

function flatDefs(): MarketItemDef[] {
  return MARKET_SECTIONS.flatMap((s) => s.items);
}

function mergeRows(map: Map<string, CachedRow>): MarketQuoteResult[] {
  return flatDefs().map((def) => {
    const c = map.get(def.id);
    return {
      def,
      price: c?.price ?? null,
      changePct: c?.changePct ?? null,
      asOfDate: c?.asOfDate ?? null,
    };
  });
}

/** 从 AsyncStorage 恢复上次成功保存的行情（无缓存则各条目为 null，结构与拉网一致）。 */
export async function loadCachedMarketQuotes(): Promise<MarketQuoteResult[]> {
  const empty = mergeRows(new Map());
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.rows)) return empty;
    const map = new Map(parsed.rows.map((r) => [r.id, r]));
    return mergeRows(map);
  } catch {
    return empty;
  }
}

export async function saveMarketQuotesCache(
  quotes: MarketQuoteResult[]
): Promise<void> {
  const rows: CachedRow[] = quotes.map((q) => ({
    id: q.def.id,
    price: q.price,
    changePct: q.changePct,
    asOfDate: q.asOfDate,
  }));
  const payload: CachedPayload = { v: 1, savedAt: Date.now(), rows };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
