/**
 * 资产市值、币种、格式化；场内判断与东方财富 secid 再导出。
 * listed 市值 = 份额 × 单价；单价优先 markPrice（盘中现价），否则 lastClose（日 K 结算）。
 */

import { toEastMoneySecid } from '@/lib/eastmoney-secid';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  getListedUnitPrice,
  isListedAssetCategory,
  type ChinaExchange,
  type SimpleAsset,
} from '@/types/asset';

export { toEastMoneySecid };
export type { ChinaExchange };

/** @deprecated 请优先使用 getShanghaiDateString；保留别名减少调用方改动 */
export function todayShanghaiDateString(): string {
  return getShanghaiDateString();
}

/** 是否应按「场内证券」拉行情：类别 + 代码 + 交易所 + 份额 */
export function isListedChineseAsset(a: SimpleAsset): boolean {
  if (!isListedAssetCategory(a.category)) return false;
  if (typeof a.shares !== 'number' || a.shares <= 0) return false;
  if (typeof a.symbol !== 'string' || !/^\d{6}$/.test(a.symbol.trim())) {
    return false;
  }
  const ex = a.exchange;
  return ex === 'SH' || ex === 'SZ' || ex === 'BJ' || ex === 'OTC';
}

export function getAssetDisplayValue(a: SimpleAsset): number {
  if (isListedChineseAsset(a)) {
    const unit = getListedUnitPrice(a);
    if (unit !== null) return a.shares! * unit;
  }
  return typeof a.value === 'number' && !Number.isNaN(a.value) ? a.value : 0;
}

export function getAssetCurrency(a: SimpleAsset): string {
  if (isListedChineseAsset(a)) return 'CNY';
  if (typeof a.currency === 'string' && /^[A-Z]{3}$/.test(a.currency)) {
    return a.currency;
  }
  return 'CNY';
}

/** 按币种格式化金额（全应用统一用这个，不要再用 en-US USD 的局部 formatCurrency） */
export function formatMoney(value: number, currency: string): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

/**
 * 按币种汇总市值（只算一遍，供净值多行文案与「是否多币种」共用）。
 */
export function aggregateByCurrency(
  assets: SimpleAsset[]
): Record<string, number> {
  const m: Record<string, number> = {};
  for (const a of assets) {
    const c = getAssetCurrency(a);
    m[c] = (m[c] ?? 0) + getAssetDisplayValue(a);
  }
  return m;
}

export function hasMultipleCurrencies(assets: SimpleAsset[]): boolean {
  return Object.keys(aggregateByCurrency(assets)).length > 1;
}

/** 一次聚合，同时得到多行净值文案与是否多币种（避免重复遍历） */
export function formatNetWorthSummary(assets: SimpleAsset[]): {
  lines: string;
  hasMultiple: boolean;
} {
  const m = aggregateByCurrency(assets);
  const keys = Object.keys(m).sort();
  const lines =
    keys.length === 0
      ? formatMoney(0, 'USD')
      : keys.map((k) => formatMoney(m[k], k)).join('\n');
  return { lines, hasMultiple: keys.length > 1 };
}

export function formatNetWorthLines(assets: SimpleAsset[]): string {
  return formatNetWorthSummary(assets).lines;
}

/** 快照用：多币种时直接相加（未汇率折算） */
export function sumDisplayValuesNaive(assets: SimpleAsset[]): number {
  return assets.reduce((s, a) => s + getAssetDisplayValue(a), 0);
}
