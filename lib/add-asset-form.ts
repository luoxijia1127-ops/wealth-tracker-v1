/**
 * 添加/编辑资产表单：校验与组装 SimpleAsset（不含读写存储、不含导航）。
 * 从 modal 拆出，方便单测与阅读。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import { generateAssetId, type AssetCategory, type SimpleAsset } from '@/types/asset';

/** 校验结果：null 表示通过，否则为错误提示文案 */
export type FormValidationError = string | null;

export type ListedFormInput = {
  name: string;
  symbol: string;
  exchange: SimpleAsset['exchange'];
  shares: string;
  /** 日 K / 参考收盘价，写入 lastClose */
  price: string;
  /** 成本价/买价（CNY/份），写入 avgCost */
  costPrice: string;
  category: AssetCategory;
  purpose: string;
  purposeTarget: string;
  isEditMode: boolean;
  hasInstrumentPick: boolean;
};

export type CashLikeFormInput = {
  name: string;
  value: string;
  category: AssetCategory;
  purpose: string;
  purposeTarget: string;
  /** 可选本金 */
  costBasis: string;
};

/**
 * 校验「场内」表单：名称、必选证券、六位代码、份额与参考收盘价。
 */
export function validateListedForm(input: ListedFormInput): FormValidationError {
  if (!input.name.trim()) return '请填写或确认标的名称。';
  if (!input.isEditMode && !input.hasInstrumentPick) {
    return '请搜索并从列表中选择一只标的（含交易所与代码）。';
  }
  if (!/^\d{6}$/.test(input.symbol.trim())) {
    return '请通过搜索选择有效的 6 位证券代码。';
  }
  const sharesNum = parseFloat(input.shares);
  const priceNum = parseFloat(input.price);
  if (
    Number.isNaN(sharesNum) ||
    sharesNum <= 0 ||
    Number.isNaN(priceNum) ||
    priceNum <= 0
  ) {
    return '请输入有效份额与收盘价 / 参考价（CNY）。';
  }
  const costNum = parseFloat(input.costPrice);
  if (!input.isEditMode) {
    if (Number.isNaN(costNum) || costNum <= 0) {
      return '请填写有效的成本价/买价（CNY/份）。';
    }
  } else if (input.costPrice.trim() !== '') {
    if (Number.isNaN(costNum) || costNum <= 0) {
      return '成本价须为正数。';
    }
  }
  return null;
}

/** 校验「现金类 / 黄金」等只填总额的资产 */
export function validateCashLikeForm(input: CashLikeFormInput): FormValidationError {
  if (!input.name.trim()) return '请填写资产名称。';
  const valueNum = parseFloat(input.value);
  if (Number.isNaN(valueNum) || valueNum < 0) {
    return '请输入有效的当前金额。';
  }
  if (input.costBasis.trim() !== '') {
    const c = parseFloat(input.costBasis);
    if (Number.isNaN(c) || c < 0) return '本金须为有效非负数。';
  }
  return null;
}

/** 从用途/目标两个输入框解析出可选字段（空则不带 key，便于从存储里清掉旧值） */
export function buildPurposeFields(
  purpose: string,
  purposeTarget: string
): Pick<SimpleAsset, 'purpose' | 'purposeTarget'> {
  const purposeTrim = purpose.trim();
  const targetParsed = parseFloat(purposeTarget);
  const out: Pick<SimpleAsset, 'purpose' | 'purposeTarget'> = {};
  if (purposeTrim.length > 0) out.purpose = purposeTrim;
  if (!Number.isNaN(targetParsed) && targetParsed > 0) {
    out.purposeTarget = targetParsed;
  }
  return out;
}

export type BuildListedParams = {
  id: string;
  name: string;
  category: AssetCategory;
  symbol: string;
  exchange: NonNullable<SimpleAsset['exchange']>;
  shares: number;
  /** 用户手填的初始「日 K 参考价」，写入 lastClose；盘中现价由同步逻辑写入 markPrice */
  initialLastClose: number;
  /** 持仓成本单价（CNY/份） */
  avgCost: number;
  purposeFields: Pick<SimpleAsset, 'purpose' | 'purposeTarget'>;
  account?: string;
  /** 来自联想的东财 secid，场外基金等必用以避免错用 0/1 市场前缀 */
  emSecid?: string;
};

/** 组装一条「场内」资产（含初始 lastClose，不含 markPrice） */
export function buildListedAsset(p: BuildListedParams): SimpleAsset {
  const value = p.shares * p.initialLastClose;
  const accountRaw =
    typeof p.account === 'string' ? p.account.trim() : '';
  const asset: SimpleAsset = {
    id: p.id,
    name: p.name.trim(),
    value,
    category: p.category,
    symbol: p.symbol.trim(),
    exchange: p.exchange,
    shares: p.shares,
    lastClose: p.initialLastClose,
    lastCloseDate: getShanghaiDateString(),
    currency: 'CNY',
    avgCost: p.avgCost,
    ...p.purposeFields,
  };
  if (accountRaw.length > 0) asset.account = accountRaw;
  if (p.emSecid && /^\d+\.\d+$/.test(p.emSecid.trim())) {
    asset.emSecid = p.emSecid.trim();
  }
  return asset;
}

export type BuildCashLikeParams = {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  /** ISO 4217，默认人民币 */
  currency: string;
  purposeFields: Pick<SimpleAsset, 'purpose' | 'purposeTarget'>;
  account?: string;
  costBasis?: number;
};

/** 组装现金类、黄金等不按行情代码估值的资产（黄金若走行情请用 buildListedAsset） */
export function buildCashLikeAsset(p: BuildCashLikeParams): SimpleAsset {
  const cur =
    typeof p.currency === 'string' && /^[A-Z]{3}$/.test(p.currency)
      ? p.currency
      : 'CNY';
  const accountRaw =
    typeof p.account === 'string' ? p.account.trim() : '';
  const out: SimpleAsset = {
    id: p.id,
    name: p.name.trim(),
    value: p.value,
    category: p.category,
    currency: cur,
    ...p.purposeFields,
  };
  if (accountRaw.length > 0) out.account = accountRaw;
  if (
    typeof p.costBasis === 'number' &&
    !Number.isNaN(p.costBasis) &&
    p.costBasis >= 0
  ) {
    out.costBasis = p.costBasis;
  }
  return out;
}

/** 生成新 id 或沿用编辑中的 id */
export function resolveAssetId(
  isEditMode: boolean,
  editingId: string | undefined,
  existingId?: string
): string {
  if (isEditMode && (existingId ?? editingId)) {
    return (existingId ?? editingId) as string;
  }
  return generateAssetId();
}
