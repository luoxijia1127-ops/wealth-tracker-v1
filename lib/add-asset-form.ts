/**
 * 添加/编辑资产表单：校验与组装 SimpleAsset（不含读写存储、不含导航）。
 * 从 modal 拆出，方便单测与阅读。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  generateAssetId,
  type AssetCategory,
  type PreciousMetalSpot,
  type SimpleAsset,
} from '@/types/asset';

/** 校验结果：null 表示通过，否则为错误提示文案 */
export type FormValidationError = string | null;

export type ListedFormInput = {
  name: string;
  symbol: string;
  exchange: SimpleAsset['exchange'];
  shares: string;
  /** 成本价/买价（与所选币种一致/份），写入 avgCost；建仓市值 = 份额×成本，收盘价由同步写入 */
  costPrice: string;
  category: AssetCategory;
  purpose: string;
  purposeTarget: string;
  isEditMode: boolean;
  hasInstrumentPick: boolean;
  /** 有值表示美股/港股（Stooq），与东财六位代码互斥 */
  intlQuoteSymbol?: string;
};

export type CashLikeFormInput = {
  name: string;
  value: string;
  category: AssetCategory;
  purpose: string;
  purposeTarget: string;
};

/**
 * 校验「场内」表单：东财 A 股/基金六位代码，或 OpenFIGI+Stooq 美股/港股。
 */
export function validateListedForm(input: ListedFormInput): FormValidationError {
  if (!input.name.trim()) return '请填写或确认标的名称。';
  const intlRaw =
    typeof input.intlQuoteSymbol === 'string'
      ? input.intlQuoteSymbol.trim()
      : '';
  const intl = intlRaw.length > 0;

  if (!input.isEditMode && !input.hasInstrumentPick) {
    return '请搜索并从列表中选择一只标的（含交易所与代码）。';
  }

  if (intl) {
    if (input.exchange !== 'US' && input.exchange !== 'HK') {
      return '请选择美股或港股联想结果。';
    }
    if (!/^[a-z0-9.\-]+\.(us|hk)$/i.test(intlRaw)) {
      return '国际行情代码无效。';
    }
  } else if (!/^\d{6}$/.test(input.symbol.trim())) {
    return '请通过搜索选择有效的 6 位证券代码。';
  }

  const sharesNum = parseFloat(input.shares);
  if (Number.isNaN(sharesNum) || sharesNum <= 0) {
    return '请输入有效的持有份额。';
  }
  const costNum = parseFloat(input.costPrice);
  if (!input.isEditMode) {
    if (Number.isNaN(costNum) || costNum <= 0) {
      return intl
        ? '请填写有效的成本价/买价（与所选币种一致/份）。'
        : '请填写有效的成本价/买价（CNY/份）。';
    }
  } else if (input.costPrice.trim() !== '') {
    if (Number.isNaN(costNum) || costNum <= 0) {
      return '成本价须为正数。';
    }
  }
  return null;
}

/** 校验「类现金 / 贵金属」等只填总额的资产 */
export function validateCashLikeForm(input: CashLikeFormInput): FormValidationError {
  if (!input.name.trim()) return '请填写资产名称。';
  const valueNum = parseFloat(input.value);
  if (Number.isNaN(valueNum) || valueNum < 0) {
    return '请输入有效的当前金额。';
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
  /** 持仓成本单价（与 listingCurrency 一致/份）；建仓市值=份额×成本，lastClose/markPrice 仅由行情同步写入 */
  avgCost: number;
  /** 首笔买入交易日 YYYY-MM-DD（上海日历日） */
  tradeDate?: string;
  purposeFields: Pick<SimpleAsset, 'purpose' | 'purposeTarget'>;
  account?: string;
  /** 报价币种（A 股为 CNY，美股多为 USD，港股多为 HKD） */
  listingCurrency: string;
  /** 来自联想的东财 secid；与 intlQuoteSymbol 互斥 */
  emSecid?: string;
  /** Stooq 符号如 aapl.us、700.hk */
  intlQuoteSymbol?: string;
  fundingSourceAssetId?: string;
  fundingSourceAssetName?: string;
  fundingTransferId?: string;
};

/** 组装一条「场内」资产（不写 lastClose；同步净值后再写入 markPrice/lastClose） */
export function buildListedAsset(p: BuildListedParams): SimpleAsset {
  const value = p.shares * p.avgCost;
  const accountRaw =
    typeof p.account === 'string' ? p.account.trim() : '';
  const cur =
    typeof p.listingCurrency === 'string' && /^[A-Z]{3}$/.test(p.listingCurrency)
      ? p.listingCurrency
      : 'CNY';
  const intl =
    typeof p.intlQuoteSymbol === 'string' && p.intlQuoteSymbol.trim().length > 0
      ? p.intlQuoteSymbol.trim().toLowerCase()
      : '';
  const tradeDay =
    typeof p.tradeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.tradeDate.trim())
      ? p.tradeDate.trim()
      : getShanghaiDateString();

  const asset: SimpleAsset = {
    id: p.id,
    name: p.name.trim(),
    value,
    category: p.category,
    symbol: p.symbol.trim(),
    exchange: p.exchange,
    shares: p.shares,
    currency: cur,
    avgCost: p.avgCost,
    tradeHistory: [
      {
        id: `baseline-${p.id}`,
        tradeDate: tradeDay,
        side: 'buy',
        shares: p.shares,
        unitPriceCny: p.avgCost,
        ...(p.fundingSourceAssetId
          ? { fundingSourceAssetId: p.fundingSourceAssetId }
          : {}),
        ...(p.fundingSourceAssetName
          ? { fundingSourceAssetName: p.fundingSourceAssetName }
          : {}),
        ...(p.fundingTransferId ? { transferId: p.fundingTransferId } : {}),
      },
    ],
    ...p.purposeFields,
  };
  if (accountRaw.length > 0) asset.account = accountRaw;
  if (intl) {
    asset.intlQuoteSymbol = intl;
  } else if (p.emSecid && /^\d+\.\d+$/.test(p.emSecid.trim())) {
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

export type GoldFormInput = {
  name: string;
  shares: string;
  /** 购买单价 CNY/克 → avgCost */
  costPrice: string;
  purpose: string;
  purposeTarget: string;
};

/** 校验贵金属：名称（来自上金联想）、克数、购买单价 */
export function validateGoldForm(input: GoldFormInput): FormValidationError {
  if (!input.name.trim()) return '请搜索并选择上金现货代码（名称将使用行情名称）。';
  const grams = parseFloat(input.shares);
  if (Number.isNaN(grams) || grams <= 0) {
    return '请填写有效的持有克数。';
  }
  const cost = parseFloat(input.costPrice);
  if (Number.isNaN(cost) || cost <= 0) {
    return '请填写有效的购买单价（CNY/克）。';
  }
  return null;
}

export type BuildGoldParams = {
  id: string;
  name: string;
  shares: number;
  avgCost: number;
  /** 首笔买入交易日 YYYY-MM-DD */
  tradeDate?: string;
  /** 现货品种，默认 XAU */
  preciousMetalSpot?: PreciousMetalSpot;
  /** 联想选中的上金现货 secid（如 118.AU9999），与 symbol、exchange 成套写入 */
  emSecid?: string;
  /** 合约代码，如 AU9999 */
  symbol?: string;
  exchange?: 'SGE';
  purposeFields: Pick<SimpleAsset, 'purpose' | 'purposeTarget'>;
  account?: string;
  fundingSourceAssetId?: string;
  fundingSourceAssetName?: string;
  fundingTransferId?: string;
};

/** 组装贵金属资产（无证券代码） */
export function buildGoldAsset(p: BuildGoldParams): SimpleAsset {
  // 新增时先按购买价估算，后续由行情同步写入 markPrice/lastClose 更新净值。
  const value = p.shares * p.avgCost;
  const accountRaw =
    typeof p.account === 'string' ? p.account.trim() : '';
  const tradeDay =
    typeof p.tradeDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.tradeDate.trim())
      ? p.tradeDate.trim()
      : getShanghaiDateString();
  const em =
    typeof p.emSecid === 'string' && /^\d+\.\d+$/.test(p.emSecid.trim())
      ? p.emSecid.trim()
      : undefined;
  const sym =
    typeof p.symbol === 'string' && p.symbol.trim().length > 0
      ? p.symbol.trim()
      : undefined;

  const out: SimpleAsset = {
    id: p.id,
    name: p.name.trim(),
    value,
    category: 'Gold',
    shares: p.shares,
    avgCost: p.avgCost,
    ...(p.preciousMetalSpot ? { preciousMetalSpot: p.preciousMetalSpot } : {}),
    tradeHistory: [
      {
        id: `baseline-${p.id}`,
        tradeDate: tradeDay,
        side: 'buy',
        shares: p.shares,
        unitPriceCny: p.avgCost,
        ...(p.fundingSourceAssetId
          ? { fundingSourceAssetId: p.fundingSourceAssetId }
          : {}),
        ...(p.fundingSourceAssetName
          ? { fundingSourceAssetName: p.fundingSourceAssetName }
          : {}),
        ...(p.fundingTransferId ? { transferId: p.fundingTransferId } : {}),
      },
    ],
    currency: 'CNY',
    ...p.purposeFields,
  };
  if (accountRaw.length > 0) out.account = accountRaw;
  if (em) out.emSecid = em;
  if (sym) out.symbol = sym;
  if (p.exchange === 'SGE' && em) out.exchange = 'SGE';
  return out;
}

/** 组装类现金等只记总额的资产 */
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
