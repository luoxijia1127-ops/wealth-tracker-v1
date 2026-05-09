import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/date-shanghai', () => ({
  getShanghaiDateString: vi.fn(() => '2026-05-02'),
}));

vi.mock('@/lib/stooq-quote', () => ({
  fetchStooqQuote: vi.fn(),
  fetchStooqCloseOnOrBefore: vi.fn(),
}));

vi.mock('@/lib/eastmoney-push', () => ({
  fetchPush2LastPrice: vi.fn(),
}));

vi.mock('@/lib/eastmoney-kline', () => ({
  fetchEastMoneyCloseOnOrBefore: vi.fn(),
}));

vi.mock('@/lib/intl-provider', () => ({
  isTwelveIntlProviderEnabled: vi.fn(() => false),
  isIntlStooqFallbackEnabled: vi.fn(() => false),
}));

vi.mock('@/lib/market-proxy-client', () => ({
  fetchTwelveQuoteViaProxy: vi.fn(),
}));

import { fetchAddAssetReferencePrice } from './add-asset-reference-price';
import * as emKline from './eastmoney-kline';
import * as emPush from './eastmoney-push';
import type { UnifiedSuggestItem } from './instrument-search';
import * as intlProvider from './intl-provider';
import * as twelveClient from './market-proxy-client';
import * as stooq from './stooq-quote';

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

/** 上金现货：QuoteID 为 118.AU9999，点后非纯数字 */
const sgeAu9999: UnifiedSuggestItem = {
  code: 'AU9999',
  name: '黄金9999',
  exchange: 'SGE',
  quoteId: '118.AU9999',
};

const aaplTwelve: UnifiedSuggestItem = {
  code: 'AAPL',
  name: 'Apple Inc',
  exchange: 'US',
  intlQuoteSymbol: 'aapl.us',
  twelveDataSymbol: 'AAPL',
  twelveDataMic: 'XNAS',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(intlProvider.isTwelveIntlProviderEnabled).mockReturnValue(false);
  vi.mocked(intlProvider.isIntlStooqFallbackEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('fetchAddAssetReferencePrice · intl 分支', () => {
  it('日期=今天：先打 q/l，命中即返回，不调用 q/d/l 整表', async () => {
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      close: 200.1,
      tradeDate: '2026-05-02',
    });
    const r = await fetchAddAssetReferencePrice(intlAapl, '2026-05-02');
    expect(r).toEqual({ price: 200.1, hint: '收盘 2026-05-02' });
    expect(stooq.fetchStooqQuote).toHaveBeenCalledTimes(1);
    expect(stooq.fetchStooqCloseOnOrBefore).not.toHaveBeenCalled();
  });

  it('日期=今天：q/l 失败再 fallback q/d/l 整表', async () => {
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (
      stooq.fetchStooqCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      close: 199.0,
      tradeDate: '2026-05-01',
    });
    const r = await fetchAddAssetReferencePrice(intlAapl, '2026-05-02');
    expect(r).toEqual({
      price: 199.0,
      hint: '2026-05-01',
    });
    expect(stooq.fetchStooqQuote).toHaveBeenCalledTimes(1);
    expect(stooq.fetchStooqCloseOnOrBefore).toHaveBeenCalledTimes(1);
  });

  it('日期=今天：q/l 拿到 tradeDate>td 视为无效，转 q/d/l', async () => {
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      close: 200.1,
      tradeDate: '2026-05-03',
    });
    (
      stooq.fetchStooqCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      close: 199.0,
      tradeDate: '2026-05-02',
    });
    const r = await fetchAddAssetReferencePrice(intlAapl, '2026-05-02');
    expect(r?.price).toBe(199.0);
    expect(stooq.fetchStooqCloseOnOrBefore).toHaveBeenCalledTimes(1);
  });

  it('历史日期：直接走 q/d/l，不先打 q/l', async () => {
    (
      stooq.fetchStooqCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      close: 180.0,
      tradeDate: '2026-04-15',
    });
    const r = await fetchAddAssetReferencePrice(intlAapl, '2026-04-15');
    expect(r?.price).toBe(180.0);
    expect(stooq.fetchStooqCloseOnOrBefore).toHaveBeenCalledTimes(1);
    expect(stooq.fetchStooqQuote).not.toHaveBeenCalled();
  });

  it('历史日期：q/d/l 失败 fallback q/l，且要求 tradeDate ≤ td', async () => {
    (
      stooq.fetchStooqCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      close: 199.0,
      tradeDate: '2026-04-10',
    });
    const r = await fetchAddAssetReferencePrice(intlAapl, '2026-04-15');
    expect(r?.price).toBe(199.0);
  });

  it('两路均失败返回 null', async () => {
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (
      stooq.fetchStooqCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    expect(
      await fetchAddAssetReferencePrice(intlAapl, '2026-05-02')
    ).toBeNull();
  });
});

describe('fetchAddAssetReferencePrice · Twelve', () => {
  it('启用代理且有成对键：走 Twelve，不调 Stooq', async () => {
    vi.mocked(intlProvider.isTwelveIntlProviderEnabled).mockReturnValue(true);
    (twelveClient.fetchTwelveQuoteViaProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      close: 201,
      tradeDate: '2026-05-02',
      currency: 'USD',
      symbol: 'AAPL',
      mic_code: 'XNAS',
      source: 'twelve_quote',
    });
    const r = await fetchAddAssetReferencePrice(aaplTwelve, '2026-05-02');
    expect(r).toEqual({ price: 201, hint: '收盘 2026-05-02' });
    expect(twelveClient.fetchTwelveQuoteViaProxy).toHaveBeenCalled();
    expect(stooq.fetchStooqQuote).not.toHaveBeenCalled();
  });

  it('Twelve 失败且无 Stooq 兜底：返回 null', async () => {
    vi.mocked(intlProvider.isTwelveIntlProviderEnabled).mockReturnValue(true);
    (twelveClient.fetchTwelveQuoteViaProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'no_close',
    });
    expect(await fetchAddAssetReferencePrice(aaplTwelve, '2026-05-02')).toBeNull();
    expect(stooq.fetchStooqQuote).not.toHaveBeenCalled();
  });

  it('Twelve 失败且开启 Stooq 兜底：回落 Stooq', async () => {
    vi.mocked(intlProvider.isTwelveIntlProviderEnabled).mockReturnValue(true);
    vi.mocked(intlProvider.isIntlStooqFallbackEnabled).mockReturnValue(true);
    (twelveClient.fetchTwelveQuoteViaProxy as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      reason: 'no_close',
    });
    (stooq.fetchStooqQuote as ReturnType<typeof vi.fn>).mockResolvedValue({
      close: 200.1,
      tradeDate: '2026-05-02',
    });
    const r = await fetchAddAssetReferencePrice(aaplTwelve, '2026-05-02');
    expect(r?.price).toBe(200.1);
    expect(stooq.fetchStooqQuote).toHaveBeenCalled();
  });
});

describe('fetchAddAssetReferencePrice · A 股分支', () => {
  it('日期=今天：先 push2 现价，命中即返回不调 kline', async () => {
    (emPush.fetchPush2LastPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      price: 1788.0,
    });
    const r = await fetchAddAssetReferencePrice(emMaotai, '2026-05-02');
    expect(r).toEqual({ price: 1788.0, hint: '现价' });
    expect(emKline.fetchEastMoneyCloseOnOrBefore).not.toHaveBeenCalled();
  });

  it('历史日期：跳过 push2 直接 kline', async () => {
    (
      emKline.fetchEastMoneyCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      close: 1700.0,
      tradeDate: '2026-04-15',
    });
    const r = await fetchAddAssetReferencePrice(emMaotai, '2026-04-15');
    expect(r?.price).toBe(1700.0);
    expect(emPush.fetchPush2LastPrice).not.toHaveBeenCalled();
  });

  it('历史日期：kline 失败 fallback push2，文案标注供参考', async () => {
    (
      emKline.fetchEastMoneyCloseOnOrBefore as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);
    (emPush.fetchPush2LastPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      price: 1800.0,
    });
    const r = await fetchAddAssetReferencePrice(emMaotai, '2026-04-15');
    expect(r?.price).toBe(1800.0);
    expect(r?.hint).toContain('参考');
  });

  it('上金现货 quoteId 含字母：走 push2 现价', async () => {
    (emPush.fetchPush2LastPrice as ReturnType<typeof vi.fn>).mockResolvedValue({
      price: 565.12,
    });
    const r = await fetchAddAssetReferencePrice(sgeAu9999, '2026-05-02');
    expect(r).toEqual({ price: 565.12, hint: '现价' });
    expect(emPush.fetchPush2LastPrice).toHaveBeenCalledWith(
      '118.AU9999',
      undefined
    );
  });

  it('quoteId 不合法返回 null', async () => {
    expect(
      await fetchAddAssetReferencePrice(
        { ...emMaotai, quoteId: 'invalid' },
        '2026-05-02'
      )
    ).toBeNull();
  });

  it('tradeDate 不合法返回 null', async () => {
    expect(
      await fetchAddAssetReferencePrice(emMaotai, '2026/05/02')
    ).toBeNull();
  });
});
