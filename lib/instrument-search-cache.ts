/**
 * 联想结果会话内 LRU + TTL 缓存。
 *
 * 解决：用户输入 "AA"→"AAP"→"AAPL" 时，每次都打三源（东财 / OpenFIGI / Stooq 探测），
 * 浪费请求且让"输入到下拉"延迟不可预测。
 *
 * 命中后同步返回浅拷贝，避免外层修改污染缓存。
 */

import {
  searchUnifiedInstruments as _searchUnifiedInstruments,
  type UnifiedSuggestItem,
} from '@/lib/instrument-search';

const DEFAULT_TTL_MS = 60 * 1000;
const DEFAULT_MAX_ENTRIES = 50;

type Entry = {
  items: UnifiedSuggestItem[];
  expireAt: number;
};

type CacheState = {
  ttlMs: number;
  maxEntries: number;
  /** 用 Map 的迭代顺序天然记录 LRU；命中后 delete + set 重新放到末尾 */
  store: Map<string, Entry>;
};

function makeState(
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES
): CacheState {
  return { ttlMs, maxEntries, store: new Map() };
}

const state: CacheState = makeState();

function normalizeKey(query: string): string {
  return query.trim().toLowerCase();
}

export function getCachedSuggestions(
  query: string,
  now: number = Date.now()
): UnifiedSuggestItem[] | null {
  const key = normalizeKey(query);
  if (!key) return null;
  const entry = state.store.get(key);
  if (!entry) return null;
  if (entry.expireAt <= now) {
    state.store.delete(key);
    return null;
  }
  /** LRU touch：删除后重插末尾 */
  state.store.delete(key);
  state.store.set(key, entry);
  return entry.items.slice();
}

export function setCachedSuggestions(
  query: string,
  items: UnifiedSuggestItem[],
  now: number = Date.now()
): void {
  const key = normalizeKey(query);
  if (!key) return;
  state.store.set(key, {
    items: items.slice(),
    expireAt: now + state.ttlMs,
  });
  while (state.store.size > state.maxEntries) {
    const oldest = state.store.keys().next().value;
    if (oldest === undefined) break;
    state.store.delete(oldest);
  }
}

/** 测试 / 切换账户 / 长时间挂起后调用 */
export function clearSuggestionCache(): void {
  state.store.clear();
}

/** 仅测试用：覆盖 TTL / max；生产代码不应调用 */
export function _configureSuggestionCacheForTest(opts: {
  ttlMs?: number;
  maxEntries?: number;
}): void {
  if (typeof opts.ttlMs === 'number') state.ttlMs = opts.ttlMs;
  if (typeof opts.maxEntries === 'number') state.maxEntries = opts.maxEntries;
}

export function _suggestionCacheSizeForTest(): number {
  return state.store.size;
}

/**
 * 包装 searchUnifiedInstruments：命中即同步返回，未命中则打网并写入缓存。
 * 失败结果不缓存（避免一次抖动让后续 60s 都拿空列表）。
 */
export async function searchUnifiedInstrumentsCached(
  query: string,
  signal?: AbortSignal
): Promise<UnifiedSuggestItem[]> {
  const cached = getCachedSuggestions(query);
  if (cached) return cached;
  const fresh = await _searchUnifiedInstruments(query, signal);
  if (signal?.aborted) return fresh;
  if (fresh.length > 0) setCachedSuggestions(query, fresh);
  return fresh;
}
