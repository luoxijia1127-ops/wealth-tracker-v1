import { describe, expect, it } from 'vitest';
import { prependExactUsTickerIfMissing } from './instrument-search';
import type { IntlSuggestRow } from './openfigi-search';

describe('prependExactUsTickerIfMissing', () => {
  const noise: IntlSuggestRow[] = [
    {
      code: 'APLY',
      name: 'Amplify ETF',
      exchange: 'US',
      intlQuoteSymbol: 'aply.us',
    },
    {
      code: 'AAPW',
      name: 'Other',
      exchange: 'US',
      intlQuoteSymbol: 'aapw.us',
    },
  ];

  it('在 2–5 位纯字母查询且列表无 aapl.us 时，把 aapl.us 插到最前', () => {
    const out = prependExactUsTickerIfMissing('aapl', noise);
    expect(out[0]?.intlQuoteSymbol).toBe('aapl.us');
    expect(out[0]?.code).toBe('AAPL');
    expect(out).toHaveLength(3);
  });

  it('已有 aapl.us 时不重复插入', () => {
    const hasAapl: IntlSuggestRow[] = [
      {
        code: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'US',
        intlQuoteSymbol: 'aapl.us',
      },
      ...noise,
    ];
    const out = prependExactUsTickerIfMissing('aapl', hasAapl);
    expect(out.filter((r) => r.intlQuoteSymbol === 'aapl.us')).toHaveLength(1);
    expect(out[0]?.code).toBe('AAPL');
  });

  it('含数字等非纯字母时不插入', () => {
    expect(prependExactUsTickerIfMissing('brk1', noise)).toEqual(noise);
  });

  it('单字母不插入', () => {
    expect(prependExactUsTickerIfMissing('f', noise)).toEqual(noise);
  });

  it('忽略首尾空白', () => {
    const out = prependExactUsTickerIfMissing('  meta  ', []);
    expect(out[0]?.intlQuoteSymbol).toBe('meta.us');
  });
});
