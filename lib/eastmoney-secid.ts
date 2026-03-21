/**
 * 东方财富 secid：行情、K 线、联想结果都用「市场前缀 + 六位代码」这一套规则。
 * 构造（toSecid）与从 QuoteID 推断交易所放在同一文件，避免两处规则漂移。
 */

import type { ChinaExchange } from '@/types/asset';

/** 沪 1.xxxxxx，深/北 0.xxxxxx，场外开放式基金 2.xxxxxx（与 push2 / push2his 一致） */
export function toEastMoneySecid(
  exchange: ChinaExchange,
  symbol: string
): string {
  const code = symbol.trim().padStart(6, '0');
  if (exchange === 'SH') return `1.${code}`;
  /** 场外开放式基金：联想 QuoteID 多为 150.xxxxxx（与旧版 2.xxx 并存，无 emSecid 时优先 150） */
  if (exchange === 'OTC') return `150.${code}`;
  return `0.${code}`;
}

/**
 * 从联想接口返回的 QuoteID（如 "1.600519"）推断交易所。
 * 北交所常见 0.92xxxx / 0.43xxxx 等，与 toEastMoneySecid(BJ) 的 0.code 一致。
 */
export function exchangeFromQuoteId(quoteId: string): ChinaExchange {
  const dot = quoteId.indexOf('.');
  const mkt = dot >= 0 ? quoteId.slice(0, dot) : '';
  const rest = dot >= 0 ? quoteId.slice(dot + 1) : '';
  if (mkt === '2') return 'OTC';
  if (mkt === '1') return 'SH';
  if (mkt === '0') {
    if (
      rest.startsWith('92') ||
      rest.startsWith('43') ||
      rest.startsWith('83') ||
      rest.startsWith('87')
    ) {
      return 'BJ';
    }
    return 'SZ';
  }
  return 'SZ';
}
