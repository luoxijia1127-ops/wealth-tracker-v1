import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/add-asset-reference-price', () => ({
  fetchAddAssetReferencePrice: vi.fn(
    async (pick: { intlQuoteSymbol?: string; quoteId?: string }) => {
      if (pick.intlQuoteSymbol === 'fail.us') return null;
      return {
        price: 123.45,
        hint: 'mocked',
      };
    }
  ),
}));

import {
  _configureReferencePriceCacheForTest,
  _referencePriceCacheSizeForTest,
  buildReferencePriceCacheKey,
  clearReferencePriceCache,
  fetchAddAssetReferencePriceCached,
  getCachedReferencePrice,
  setCachedReferencePrice,
} from './add-asset-reference-price-cache';
import * as referencePrice from './add-asset-reference-price';
import type { UnifiedSuggestItem } from './instrument-search';

const intlAapl: UnifiedSuggestItem = {
  code: 'AAPL',
  name: 'Apple Inc',
  exchange: 'US',
  intlQuoteSymbol: 'aapl.us',
};

const emMaotai: UnifiedSuggestItem = {
  code: '600519',
  name: '贵州茅台',
  exchange: 'SH',
  quoteId: '1.600519',
};

beforeEach(() => {
  clearReferencePriceCache();
  _configureReferencePriceCacheForTest({ ttlMs: 60_000, maxEntries: 50 });
  vi.clearAllMocks();
});

afterEach(() => {
  clearReferencePriceCache();
});

describe('buildReferencePriceCacheKey', () => {
  it('intlQuoteSymbol 优先并归一化大小写', () => {
    expect(
      buildReferencePriceCacheKey(
        { ...intlAapl, intlQuoteSymbol: 'AAPL.US' },
        '2026-05-02'
      )
    ).toBe('intl:aapl.us|2026-05-02');
  });

  it('无 intlQuoteSymbol 时退回 quoteId', () => {
    expect(buildReferencePriceCacheKey(emMaotai, '2026-05-02')).toBe(
      'em:1.600519|2026-05-02'
    );
  });

  it('日期格式不合法返回 null', () => {
    expect(buildReferencePriceCacheKey(intlAapl, '2026/05/02')).toBeNull();
    expect(buildReferencePriceCacheKey(intlAapl, '')).toBeNull();
  });

  it('两个标识都缺失返回 null', () => {
    expect(
      buildReferencePriceCacheKey(
        { code: 'X', name: 'X', exchange: 'US' },
        '2026-05-02'
      )
    ).toBeNull();
  });
});

describe('add-asset-reference-price-cache · 纯缓存', () => {
  it('set / get 命中后是浅拷贝', () => {
    setCachedReferencePrice('intl:aapl.us|2026-05-02', {
      price: 100,
      hint: 'h',
    });
    const a = getCachedReferencePrice('intl:aapl.us|2026-05-02')!;
    a.price = 0;
    const b = getCachedReferencePrice('intl:aapl.us|2026-05-02')!;
    expect(b.price).toBe(100);
  });

  it('TTL 过期失效', () => {
    _configureReferencePriceCacheForTest({ ttlMs: 1000 });
    const t0 = 1_000_000;
    setCachedReferencePrice('k', { price: 1, hint: '' }, t0);
    expect(getCachedReferencePrice('k', t0 + 999)).not.toBeNull();
    expect(getCachedReferencePrice('k', t0 + 1001)).toBeNull();
  });

  it('LRU 超限淘汰最旧', () => {
    _configureReferencePriceCacheForTest({ maxEntries: 2 });
    setCachedReferencePrice('a', { price: 1, hint: '' });
    setCachedReferencePrice('b', { price: 2, hint: '' });
    setCachedReferencePrice('c', { price: 3, hint: '' });
    expect(_referencePriceCacheSizeForTest()).toBe(2);
    expect(getCachedReferencePrice('a')).toBeNull();
    expect(getCachedReferencePrice('b')).not.toBeNull();
    expect(getCachedReferencePrice('c')).not.toBeNull();
  });
});

describe('fetchAddAssetReferencePriceCached · 包装层', () => {
  it('同一标的 + 同一日期，第二次不打网', async () => {
    const spy = referencePrice.fetchAddAssetReferencePrice as ReturnType<
      typeof vi.fn
    >;
    await fetchAddAssetReferencePriceCached(intlAapl, '2026-05-02');
    await fetchAddAssetReferencePriceCached(intlAapl, '2026-05-02');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('换日期会重新打网', async () => {
    const spy = referencePrice.fetchAddAssetReferencePrice as ReturnType<
      typeof vi.fn
    >;
    await fetchAddAssetReferencePriceCached(intlAapl, '2026-05-02');
    await fetchAddAssetReferencePriceCached(intlAapl, '2026-05-01');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('返回 null 不缓存（下次仍尝试打网）', async () => {
    const spy = referencePrice.fetchAddAssetReferencePrice as ReturnType<
      typeof vi.fn
    >;
    const failPick: UnifiedSuggestItem = {
      code: 'X',
      name: 'X',
      exchange: 'US',
      intlQuoteSymbol: 'fail.us',
    };
    expect(
      await fetchAddAssetReferencePriceCached(failPick, '2026-05-02')
    ).toBeNull();
    expect(
      await fetchAddAssetReferencePriceCached(failPick, '2026-05-02')
    ).toBeNull();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('signal 已 abort 时不缓存', async () => {
    const ac = new AbortController();
    ac.abort();
    await fetchAddAssetReferencePriceCached(intlAapl, '2026-05-02', ac.signal);
    expect(_referencePriceCacheSizeForTest()).toBe(0);
  });

  it('日期不合法不缓存但仍调底层（底层自行拒绝）', async () => {
    const spy = referencePrice.fetchAddAssetReferencePrice as ReturnType<
      typeof vi.fn
    >;
    await fetchAddAssetReferencePriceCached(intlAapl, '2026/05/02');
    await fetchAddAssetReferencePriceCached(intlAapl, '2026/05/02');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(_referencePriceCacheSizeForTest()).toBe(0);
  });
});
