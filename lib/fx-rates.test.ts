import { describe, expect, it } from 'vitest';
import {
  convertDisplayValueToCny,
  convertDisplayValueToCurrency,
  hasUsdAnchoredFxTable,
} from './fx-rates';

const usdRates = {
  CNY: 7.2,
  USD: 1,
  EUR: 0.92,
  JPY: 155,
};

describe('convertDisplayValueToCny', () => {
  it('returns the same amount when currency is CNY', () => {
    expect(convertDisplayValueToCny(1000, 'CNY', usdRates)).toBe(1000);
  });

  it('converts USD directly via CNY rate', () => {
    expect(convertDisplayValueToCny(100, 'USD', usdRates)).toBeCloseTo(720);
  });

  it('converts EUR through USD anchor', () => {
    const usd = 100 / 0.92;
    expect(convertDisplayValueToCny(100, 'EUR', usdRates)).toBeCloseTo(usd * 7.2);
  });

  it('falls back to raw amount when currency lookup fails', () => {
    expect(convertDisplayValueToCny(100, 'XYZ', usdRates)).toBe(100);
  });

  it('returns 0 for non-finite input', () => {
    expect(convertDisplayValueToCny(Number.NaN, 'USD', usdRates)).toBe(0);
  });
});

describe('convertDisplayValueToCurrency', () => {
  it('is identity when from and to match', () => {
    expect(convertDisplayValueToCurrency(50, 'USD', 'USD', usdRates)).toBe(50);
  });

  it('round-trips a value through USD', () => {
    const eur = convertDisplayValueToCurrency(720, 'CNY', 'EUR', usdRates);
    const backToCny = convertDisplayValueToCurrency(eur, 'EUR', 'CNY', usdRates);
    expect(backToCny).toBeCloseTo(720, 5);
  });

  it('returns NaN when a rate is missing', () => {
    expect(
      convertDisplayValueToCurrency(100, 'EUR', 'XYZ', usdRates)
    ).toBeNaN();
  });
});

describe('hasUsdAnchoredFxTable', () => {
  it('returns true when any non-USD positive rate exists', () => {
    expect(hasUsdAnchoredFxTable(usdRates)).toBe(true);
  });

  it('returns false for empty / invalid tables', () => {
    expect(hasUsdAnchoredFxTable(null)).toBe(false);
    expect(hasUsdAnchoredFxTable({ USD: 1, CNY: 0 })).toBe(false);
  });
});
