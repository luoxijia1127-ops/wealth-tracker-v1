/**
 * 资产市值、币种、格式化；场内判断与东方财富 secid 再导出。
 * listed 市值 = 份额 × 单价；单价优先 markPrice（盘中现价），否则 lastClose（日 K 结算）。
 */

import { toEastMoneySecid } from '@/lib/eastmoney-secid';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  convertDisplayValueToCny,
  convertDisplayValueToCurrency,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  getListedUnitPrice,
  isListedAssetCategory,
  type ChinaExchange,
  type SimpleAsset,
} from '@/types/asset';

function heldLikeShape(a: SimpleAsset): boolean {
  if (typeof a.shares !== 'number' || a.shares <= 0) return false;
  if (typeof a.symbol !== 'string' || !/^\d{6}$/.test(a.symbol.trim())) {
    return false;
  }
  const ex = a.exchange;
  return ex === 'SH' || ex === 'SZ' || ex === 'BJ' || ex === 'OTC';
}

/** 股票/基金/ETF 且具备六位代码与交易所（东财行情、按份额估值） */
export function isListedChineseAsset(a: SimpleAsset): boolean {
  if (!isListedAssetCategory(a.category)) return false;
  return heldLikeShape(a);
}

/** 美股 / 港股等：Stooq + OpenFIGI，与 A 股东财互斥 */
export function isInternationalListedAsset(a: SimpleAsset): boolean {
  if (!isListedAssetCategory(a.category)) return false;
  if (typeof a.shares !== 'number' || a.shares <= 0) return false;
  const iq =
    typeof a.intlQuoteSymbol === 'string' && a.intlQuoteSymbol.trim().length > 0;
  return iq && (a.exchange === 'US' || a.exchange === 'HK');
}

/**
 * 贵金属（账户金/银等实物记账）：按克持仓 + CNY/克 参考价，不依赖证券代码。
 */
export function isGoldChineseAsset(a: SimpleAsset): boolean {
  return a.category === 'Gold' && typeof a.shares === 'number' && a.shares > 0;
}

/** A 股/港股美股场内、或贵金属（含流水与行情估值口径） */
export function isHeldChineseAsset(a: SimpleAsset): boolean {
  return (
    isListedChineseAsset(a) ||
    isInternationalListedAsset(a) ||
    isGoldChineseAsset(a)
  );
}

/**
 * Dashboard 首屏：已清仓的场内/贵金属（份额≤0）与余额为 0 的类现金不展示。
 */
export function filterAssetsForDashboard(assets: SimpleAsset[]): SimpleAsset[] {
  return assets.filter((a) => {
    if (a.category === 'Cash' || a.category === 'Custom') {
      const v =
        typeof a.value === 'number' && !Number.isNaN(a.value) ? a.value : 0;
      return v > 0;
    }
    if (isListedAssetCategory(a.category) || a.category === 'Gold') {
      const sh = typeof a.shares === 'number' ? a.shares : 0;
      return sh > 0;
    }
    return true;
  });
}

/** 主列表不展示：现金余额为 0、场内/贵金属份额≤0 等（清仓后仍可能留在存储中） */
export function isAssetHiddenFromDashboard(a: SimpleAsset): boolean {
  return filterAssetsForDashboard([a]).length === 0;
}

export { toEastMoneySecid };
export type { ChinaExchange };

/** @deprecated 请优先使用 getShanghaiDateString；保留别名减少调用方改动 */
export function todayShanghaiDateString(): string {
  return getShanghaiDateString();
}

export function getAssetDisplayValue(a: SimpleAsset): number {
  if (isHeldChineseAsset(a)) {
    const unit = getListedUnitPrice(a);
    if (unit !== null) return a.shares! * unit;
  }
  return typeof a.value === 'number' && !Number.isNaN(a.value) ? a.value : 0;
}

export function getAssetCurrency(a: SimpleAsset): string {
  if (isListedChineseAsset(a)) return 'CNY';
  if (isInternationalListedAsset(a)) {
    const c = a.currency;
    if (typeof c === 'string' && /^[A-Z]{3}$/.test(c)) return c;
    return a.exchange === 'HK' ? 'HKD' : 'USD';
  }
  if (isGoldChineseAsset(a)) return 'CNY';
  if (typeof a.currency === 'string' && /^[A-Z]{3}$/.test(a.currency)) {
    return a.currency;
  }
  return 'CNY';
}

/**
 * 从首个数字起将连续数字段格式化为每三位英文逗号（保留前方币种、空格等前缀）。
 */
function enforceCommaThousandsInFormattedMoneyMain(main: string): string {
  const firstDigit = main.search(/\d/);
  if (firstDigit === -1) return main;
  const prefix = main.slice(0, firstDigit);
  const rest = main.slice(firstDigit);
  const digits = rest.replace(/\D/g, '');
  if (digits.length === 0) return main;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return prefix + grouped;
}

/** 对 `formatMoney` / `formatMoneyDisplayParts` 的整串：小数点按末位 `.` 后 1～2 位小数切分，其余并入主段加逗号。 */
function enforceCommaThousandsInMoneyString(formatted: string): string {
  const dot = formatted.lastIndexOf('.');
  if (dot < 0) {
    return enforceCommaThousandsInFormattedMoneyMain(formatted);
  }
  const after = formatted.slice(dot + 1);
  if (/^\d{1,2}$/.test(after)) {
    return (
      enforceCommaThousandsInFormattedMoneyMain(formatted.slice(0, dot)) +
      formatted.slice(dot)
    );
  }
  return enforceCommaThousandsInFormattedMoneyMain(formatted);
}

/** 按币种格式化金额（全应用统一用这个，不要再用 en-US USD 的局部 formatCurrency） */
export function formatMoney(value: number, currency: string): string {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  try {
    const s = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return enforceCommaThousandsInMoneyString(s);
  } catch {
    return enforceCommaThousandsInMoneyString(`${code} ${value.toFixed(2)}`);
  }
}

/** 供大字报式 UI：币种 + 整数一段、小数点及两位一段 */
export type MoneyDisplayParts = {
  leading: string;
  integer: string;
  fraction: string;
};

/**
 * 拆成主数字 + 小数（固定两位），与 {@link formatMoney} 可能省略小数不同。
 * 用完整 `format()` 再拆分，保证与界面其它金额一致（含千分位逗号等）。
 */
export function formatMoneyDisplayParts(
  value: number,
  currency: string
): MoneyDisplayParts {
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  try {
    const raw = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    const s = enforceCommaThousandsInMoneyString(raw);
    const dot = s.lastIndexOf('.');
    if (dot >= 0 && dot < s.length - 1) {
      const fracDigits = s.slice(dot + 1);
      if (/^\d{2}$/.test(fracDigits)) {
        return {
          leading: '',
          integer: s.slice(0, dot),
          fraction: s.slice(dot),
        };
      }
    }
    return { leading: '', integer: s, fraction: '' };
  } catch {
    const fixed = Number.isFinite(value) ? value.toFixed(2) : '0.00';
    const dot = fixed.indexOf('.');
    const main =
      dot >= 0
        ? enforceCommaThousandsInFormattedMoneyMain(`${code} ${fixed.slice(0, dot)}`)
        : enforceCommaThousandsInFormattedMoneyMain(`${code} ${fixed}`);
    const frac = dot >= 0 ? fixed.slice(dot) : '';
    return {
      leading: '',
      integer: main,
      fraction: frac,
    };
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

/**
 * 按 USD 基准中间价折到目标币种；无有效汇率且存在与目标币种不一致的资产时为 null。
 * 无汇率且全部资产已为目标币种时，回退为未折算直接加总（数值与 naive 一致）。
 */
export function sumDisplayValuesInCurrency(
  assets: SimpleAsset[],
  targetCurrency: string,
  usdRates: FxUsdMidRates['rates'] | null | undefined
): number | null {
  const target = /^[A-Z]{3}$/.test(targetCurrency) ? targetCurrency : 'CNY';
  const allInTarget =
    assets.length === 0 ||
    assets.every((a) => getAssetCurrency(a) === target);
  if (!usdRates || !(usdRates.CNY > 0)) {
    return allInTarget ? sumDisplayValuesNaive(assets) : null;
  }
  let sum = 0;
  for (const a of assets) {
    const v = convertDisplayValueToCurrency(
      getAssetDisplayValue(a),
      getAssetCurrency(a),
      target,
      usdRates
    );
    if (!Number.isFinite(v)) return null;
    sum += v;
  }
  return sum;
}

/** 按 USD 基准中间价串联折人民币；rates 缺失时回退为未折算直接加总 */
export function sumDisplayValuesInCny(
  assets: SimpleAsset[],
  usdRates: FxUsdMidRates['rates'] | null | undefined
): number {
  const unified = sumDisplayValuesInCurrency(assets, 'CNY', usdRates);
  return unified !== null ? unified : sumDisplayValuesNaive(assets);
}
