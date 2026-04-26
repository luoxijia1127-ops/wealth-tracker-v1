import { describe, expect, it } from 'vitest';
import { intlStooqPriceFallbackAliases } from './stooq-quote';

describe('intlStooqPriceFallbackAliases', () => {
  it('pairs .l with .uk for LSE Stooq symbols', () => {
    expect(intlStooqPriceFallbackAliases('flxc.l')).toEqual(['flxc.l', 'flxc.uk']);
    expect(intlStooqPriceFallbackAliases('FLXC.L')).toEqual(['flxc.l', 'flxc.uk']);
  });

  it('pairs .uk with .l', () => {
    expect(intlStooqPriceFallbackAliases('flxc.uk')).toEqual(['flxc.uk', 'flxc.l']);
  });

  it('leaves non-LSE suffix symbols unchanged', () => {
    expect(intlStooqPriceFallbackAliases('aapl.us')).toEqual(['aapl.us']);
    expect(intlStooqPriceFallbackAliases('700.hk')).toEqual(['700.hk']);
  });
});
