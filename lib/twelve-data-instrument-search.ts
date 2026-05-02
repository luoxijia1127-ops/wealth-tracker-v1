/**
 * Twelve Data（经 Vercel 代理）国际联想 → 与 legacy 相同的 IntlSuggestRow 形状。
 */

import {
  buildIntlStooqSymbol,
  INTL_VENUE_DEFAULT_STOOQ_SUFFIX,
  type IntlListingExchange,
} from '@/lib/intl-exchange-stooq';
import { hkTickerToStooq, usTickerToStooq, type IntlSuggestRow } from '@/lib/openfigi-search';
import { listingExchangeFromTwelveRow } from '@/lib/twelve-data-exchange-map';
import { fetchTwelveSymbolSearchViaProxy } from '@/lib/market-proxy-client';

function intlStooqSymbolForVenue(
  venue: IntlListingExchange,
  tickerRaw: string
): string | null {
  const t = tickerRaw.trim();
  if (!t) return null;
  if (venue === 'US') return usTickerToStooq(t);
  if (venue === 'HK') return hkTickerToStooq(t);
  const suf = INTL_VENUE_DEFAULT_STOOQ_SUFFIX[venue];
  return buildIntlStooqSymbol(t, suf);
}

/**
 * 调用代理 symbol_search，映射为 IntlSuggestRow（含 twelveData* 供报价与存盘）。
 */
export async function searchTwelveDataIntl(
  query: string,
  signal?: AbortSignal
): Promise<IntlSuggestRow[]> {
  const rows = await fetchTwelveSymbolSearchViaProxy(query, signal, 20);
  const out: IntlSuggestRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const sym = String(row.symbol ?? '').trim();
    const mic = String(row.mic_code ?? '').trim().toUpperCase();
    const nm = String(row.instrument_name ?? '').trim();
    if (!sym || !mic || !nm) continue;

    const venue = listingExchangeFromTwelveRow({
      mic_code: mic,
      country: row.country,
      instrument_type: row.instrument_type,
    });
    if (!venue) continue;

    const intlQuoteSymbol = intlStooqSymbolForVenue(venue, sym);
    if (!intlQuoteSymbol) continue;

    const dedupeKey = `${sym.toUpperCase()}|${mic}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      code: sym.replace(/\./g, '-').toUpperCase(),
      name: nm,
      exchange: venue,
      intlQuoteSymbol,
      twelveDataSymbol: sym,
      twelveDataMic: mic,
    });
    if (out.length >= 14) break;
  }

  return out;
}
