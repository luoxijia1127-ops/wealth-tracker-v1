/**
 * 「选中候选 → 拉参考价」会话内 LRU + TTL 缓存。
 *
 * 解决：用户选中 AAPL 后改一下交易日期、或来回切换证券/上金表单时，
 * 同一 (symbol|secid, tradeDate) 不必重复打 Stooq / 东财。
 *
 * 缓存键：优先 intlQuoteSymbol（小写）；否则 quoteId（secid）。
 * 失败结果（null）不缓存，避免一次抖动让后续 60s 都拿不到价。
 */

import {
  fetchAddAssetReferencePrice as _fetchAddAssetReferencePrice,
  type ReferencePriceResult,
} from '@/lib/add-asset-reference-price';
import type { UnifiedSuggestItem } from '@/lib/instrument-search';

const DEFAULT_TTL_MS = 60 * 1000;
const DEFAULT_MAX_ENTRIES = 50;

type Entry = {
  result: ReferencePriceResult;
  expireAt: number;
};

type CacheState = {
  ttlMs: number;
  maxEntries: number;
  store: Map<string, Entry>;
};

const state: CacheState = {
  ttlMs: DEFAULT_TTL_MS,
  maxEntries: DEFAULT_MAX_ENTRIES,
  store: new Map(),
};

export function buildReferencePriceCacheKey(
  pick: UnifiedSuggestItem,
  tradeDate: string
): string | null {
  const td = tradeDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) return null;
  const intl = pick.intlQuoteSymbol?.trim().toLowerCase() ?? '';
  if (intl.length > 0) return `intl:${intl}|${td}`;
  const secid = pick.quoteId?.trim() ?? '';
  if (/^\d+\.\d+$/.test(secid)) return `em:${secid}|${td}`;
  return null;
}

export function getCachedReferencePrice(
  key: string,
  now: number = Date.now()
): ReferencePriceResult | null {
  const entry = state.store.get(key);
  if (!entry) return null;
  if (entry.expireAt <= now) {
    state.store.delete(key);
    return null;
  }
  state.store.delete(key);
  state.store.set(key, entry);
  return { ...entry.result };
}

export function setCachedReferencePrice(
  key: string,
  result: ReferencePriceResult,
  now: number = Date.now()
): void {
  state.store.set(key, {
    result: { ...result },
    expireAt: now + state.ttlMs,
  });
  while (state.store.size > state.maxEntries) {
    const oldest = state.store.keys().next().value;
    if (oldest === undefined) break;
    state.store.delete(oldest);
  }
}

export function clearReferencePriceCache(): void {
  state.store.clear();
}

export function _configureReferencePriceCacheForTest(opts: {
  ttlMs?: number;
  maxEntries?: number;
}): void {
  if (typeof opts.ttlMs === 'number') state.ttlMs = opts.ttlMs;
  if (typeof opts.maxEntries === 'number') state.maxEntries = opts.maxEntries;
}

export function _referencePriceCacheSizeForTest(): number {
  return state.store.size;
}

/**
 * 包装 fetchAddAssetReferencePrice：缓存命中则同步返回；未命中或键不可缓存则透传。
 */
export async function fetchAddAssetReferencePriceCached(
  pick: UnifiedSuggestItem,
  tradeDate: string,
  signal?: AbortSignal
): Promise<ReferencePriceResult | null> {
  const key = buildReferencePriceCacheKey(pick, tradeDate);
  if (key) {
    const hit = getCachedReferencePrice(key);
    if (hit) return hit;
  }
  const fresh = await _fetchAddAssetReferencePrice(pick, tradeDate, signal);
  if (signal?.aborted) return fresh;
  if (fresh && key) setCachedReferencePrice(key, fresh);
  return fresh;
}
