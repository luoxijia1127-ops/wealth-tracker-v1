/**
 * Twelve Data symbol_search 行 → 本 App `IntlListingExchange`。
 * 优先 MIC（ISO 10383），其次国家名兜底。
 */

import type { IntlListingExchange } from '@/lib/intl-exchange-stooq';

const MIC_VENUE: Record<string, IntlListingExchange> = {
  XNAS: 'US',
  XNYS: 'US',
  ARCX: 'US',
  BATS: 'US',
  BATY: 'US',
  IEXG: 'US',
  XCIS: 'US',
  FINN: 'US',
  XCHI: 'US',
  XHKG: 'HK',
  XLON: 'LSE',
  XLOM: 'LSE',
  XETR: 'XETR',
  XFRA: 'XETR',
  XSTU: 'XETR',
  XPAR: 'XPAR',
  XAMS: 'XAMS',
  XBRU: 'XAMS',
  XSWX: 'XSWX',
  XMIL: 'XMIL',
  BMEX: 'BMEX',
  XSTO: 'XSTO',
  XOSL: 'XOSL',
  XCSE: 'XCSE',
  XHEL: 'XHEL',
  XDUB: 'XDUB',
  XTOR: 'US',
  XCNQ: 'US',
};

const COUNTRY_VENUE: Record<string, IntlListingExchange> = {
  'United States': 'US',
  'Hong Kong': 'HK',
  'United Kingdom': 'LSE',
  Germany: 'XETR',
  France: 'XPAR',
  Netherlands: 'XAMS',
  Switzerland: 'XSWX',
  Italy: 'XMIL',
  Spain: 'BMEX',
  Sweden: 'XSTO',
  Norway: 'XOSL',
  Denmark: 'XCSE',
  Finland: 'XHEL',
  Ireland: 'XDUB',
};

const SKIP_INSTRUMENT = /index|future|option|warrant|swap|commodity\s+future/i;

export function listingExchangeFromTwelveRow(row: {
  mic_code?: string;
  country?: string;
  instrument_type?: string;
}): IntlListingExchange | null {
  const it = String(row.instrument_type ?? '');
  if (SKIP_INSTRUMENT.test(it)) return null;

  const mic = String(row.mic_code ?? '').trim().toUpperCase();
  if (mic && MIC_VENUE[mic]) return MIC_VENUE[mic]!;

  const c = String(row.country ?? '').trim();
  if (c && COUNTRY_VENUE[c]) return COUNTRY_VENUE[c]!;

  return null;
}
