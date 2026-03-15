/**
 * Shared asset and goal types, storage keys, and helpers.
 * Used by Add Asset screen, Dashboard, and Portfolio so all screens use the same data shape.
 */

// ---- Storage keys ----
export const ASSETS_STORAGE_KEY = 'wealth_tracker_assets';
export const GOALS_STORAGE_KEY = 'wealth_tracker_goals';

// ---- Categories (top-level asset classification) ----
export type AssetCategory = 'short_term' | 'long_term' | 'cash_like' | 'other';

// SubTypes depend on category
export type InvestmentSubType = 'stock' | 'etf' | 'fund';
export type CashLikeSubType = 'bank' | 'alipay' | 'zhaozhaobao' | 'other';
export type OtherSubType = 'gold' | 'other';

export type AssetSubType = InvestmentSubType | CashLikeSubType | OtherSubType;

// ---- Asset (new format) ----
export type Asset = {
  id: string;
  name: string;
  category: AssetCategory;
  subType: AssetSubType;
  // Investment (short_term / long_term)
  shares?: number;
  price?: number;
  // Cash-like
  principal?: number;
  interest?: number;
  // Optional link to a goal (e.g. 买车, 旅游)
  goalId: string | null;
};

// ---- Goal ----
export type Goal = {
  id: string;
  name: string;
  targetAmount: number | null;
  monthlyContribution: number | null;
};

// ---- Legacy format (old Add Asset saved type + shares + price only) ----
type LegacyAsset = {
  id: string;
  name: string;
  type: 'Stock' | 'Fund' | 'Cash';
  shares: number;
  price: number;
};

/** Returns true if the item is in the legacy format (has `type` and no `category`). */
export function isLegacyAsset(item: unknown): item is LegacyAsset {
  if (!item || typeof item !== 'object') return false;
  const o = item as Record<string, unknown>;
  return (
    typeof o.type === 'string' &&
    ['Stock', 'Fund', 'Cash'].includes(o.type) &&
    o.category === undefined
  );
}

/** Convert a legacy asset to the new Asset shape. */
export function migrateLegacyAsset(legacy: LegacyAsset): Asset {
  const category: AssetCategory =
    legacy.type === 'Cash' ? 'cash_like' : 'short_term';
  const subType: AssetSubType =
    legacy.type === 'Stock'
      ? 'stock'
      : legacy.type === 'Fund'
        ? 'fund'
        : 'other'; // Cash -> cash_like + other
  const base: Asset = {
    id: legacy.id,
    name: legacy.name,
    category,
    subType,
    goalId: null,
  };
  if (category === 'cash_like') {
    const value = legacy.shares * legacy.price;
    return { ...base, principal: value, interest: 0 };
  }
  return { ...base, shares: legacy.shares, price: legacy.price };
}

/** Compute display value for an asset (for net worth, lists). */
export function getAssetValue(asset: Asset): number {
  if (asset.category === 'cash_like' || asset.category === 'other') {
    const p = asset.principal ?? 0;
    const i = asset.interest ?? 0;
    return p + i;
  }
  const s = asset.shares ?? 0;
  const pr = asset.price ?? 0;
  return s * pr;
}

/** Parse stored JSON and return Asset[], migrating any legacy items to the new format. */
export function parseAssetsArray(stored: string | null): Asset[] {
  if (!stored) return [];
  try {
    const raw = JSON.parse(stored) as unknown[];
    return raw.map((item) => {
      if (isLegacyAsset(item)) return migrateLegacyAsset(item);
      return item as Asset;
    });
  } catch {
    return [];
  }
}

// ---- Constants for UI (labels and options) ----
export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  short_term: '短期',
  long_term: '长期',
  cash_like: '类现金',
  other: '其他',
};

export const INVESTMENT_SUBTYPES: { value: InvestmentSubType; label: string }[] = [
  { value: 'stock', label: '股票' },
  { value: 'etf', label: 'ETF' },
  { value: 'fund', label: '基金' },
];

export const CASH_LIKE_SUBTYPES: { value: CashLikeSubType; label: string }[] = [
  { value: 'bank', label: '银行存款' },
  { value: 'alipay', label: '支付宝' },
  { value: 'zhaozhaobao', label: '朝朝宝' },
  { value: 'other', label: '其他' },
];

export const OTHER_SUBTYPES: { value: OtherSubType; label: string }[] = [
  { value: 'gold', label: '黄金' },
  { value: 'other', label: '其他' },
];

export const CATEGORY_OPTIONS: AssetCategory[] = [
  'short_term',
  'long_term',
  'cash_like',
  'other',
];
