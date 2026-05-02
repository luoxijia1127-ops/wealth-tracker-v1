import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/instrument-search', () => ({
  searchUnifiedInstruments: vi.fn(async (q: string) =>
    q === 'aapl'
      ? [
          {
            code: 'AAPL',
            name: 'Apple Inc',
            exchange: 'US' as const,
            intlQuoteSymbol: 'aapl.us',
          },
        ]
      : []
  ),
}));

import {
  _configureSuggestionCacheForTest,
  _suggestionCacheSizeForTest,
  clearSuggestionCache,
  getCachedSuggestions,
  searchUnifiedInstrumentsCached,
  setCachedSuggestions,
} from './instrument-search-cache';
import * as instrumentSearch from './instrument-search';

beforeEach(() => {
  clearSuggestionCache();
  _configureSuggestionCacheForTest({ ttlMs: 60_000, maxEntries: 50 });
  vi.clearAllMocks();
});

afterEach(() => {
  clearSuggestionCache();
});

describe('instrument-search-cache · 纯缓存', () => {
  const item = (code: string) => ({
    code,
    name: code,
    exchange: 'US' as const,
    intlQuoteSymbol: `${code.toLowerCase()}.us`,
  });

  it('set 后命中相同 query；大小写与首尾空白被归一化', () => {
    setCachedSuggestions('AAPL', [item('AAPL')]);
    expect(getCachedSuggestions('aapl')).toEqual([item('AAPL')]);
    expect(getCachedSuggestions('  AAPL  ')).toEqual([item('AAPL')]);
  });

  it('返回的是浅拷贝，外部修改不污染缓存', () => {
    setCachedSuggestions('AAPL', [item('AAPL')]);
    const a = getCachedSuggestions('aapl')!;
    a.pop();
    const b = getCachedSuggestions('aapl')!;
    expect(b).toHaveLength(1);
  });

  it('TTL 过期返回 null 并清除', () => {
    _configureSuggestionCacheForTest({ ttlMs: 1000 });
    const t0 = 1_000_000;
    setCachedSuggestions('AAPL', [item('AAPL')], t0);
    expect(getCachedSuggestions('aapl', t0 + 999)).not.toBeNull();
    expect(getCachedSuggestions('aapl', t0 + 1001)).toBeNull();
    expect(_suggestionCacheSizeForTest()).toBe(0);
  });

  it('超出 maxEntries 淘汰最旧条目', () => {
    _configureSuggestionCacheForTest({ maxEntries: 3 });
    setCachedSuggestions('A', [item('A')]);
    setCachedSuggestions('B', [item('B')]);
    setCachedSuggestions('C', [item('C')]);
    setCachedSuggestions('D', [item('D')]);
    expect(_suggestionCacheSizeForTest()).toBe(3);
    expect(getCachedSuggestions('a')).toBeNull();
    expect(getCachedSuggestions('b')).not.toBeNull();
  });

  it('命中后做 LRU touch，最近使用的不会被先淘汰', () => {
    _configureSuggestionCacheForTest({ maxEntries: 3 });
    setCachedSuggestions('A', [item('A')]);
    setCachedSuggestions('B', [item('B')]);
    setCachedSuggestions('C', [item('C')]);
    /** 触摸 A 后写入 D：被淘汰的应是 B（最旧），不是 A */
    expect(getCachedSuggestions('a')).not.toBeNull();
    setCachedSuggestions('D', [item('D')]);
    expect(getCachedSuggestions('b')).toBeNull();
    expect(getCachedSuggestions('a')).not.toBeNull();
  });

  it('空 query 既不写入也不命中', () => {
    setCachedSuggestions('  ', [item('X')]);
    expect(_suggestionCacheSizeForTest()).toBe(0);
    expect(getCachedSuggestions('')).toBeNull();
  });
});

describe('searchUnifiedInstrumentsCached · 包装层', () => {
  it('未命中先打网，再次相同 query 走缓存不打网', async () => {
    const spy = instrumentSearch.searchUnifiedInstruments as ReturnType<
      typeof vi.fn
    >;
    const a = await searchUnifiedInstrumentsCached('aapl');
    const b = await searchUnifiedInstrumentsCached('aapl');
    expect(a).toEqual(b);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('返回空数组不写入缓存（避免抖动让后续都拿空）', async () => {
    const spy = instrumentSearch.searchUnifiedInstruments as ReturnType<
      typeof vi.fn
    >;
    await searchUnifiedInstrumentsCached('zzz');
    await searchUnifiedInstrumentsCached('zzz');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('signal 已 abort 时不缓存（避免被裁剪的结果污染下一次）', async () => {
    const spy = instrumentSearch.searchUnifiedInstruments as ReturnType<
      typeof vi.fn
    >;
    const ac = new AbortController();
    ac.abort();
    await searchUnifiedInstrumentsCached('aapl', ac.signal);
    expect(_suggestionCacheSizeForTest()).toBe(0);
    /** 后续未取消的请求仍会重新打网 */
    await searchUnifiedInstrumentsCached('aapl');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
