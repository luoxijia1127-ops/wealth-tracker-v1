/**
 * 全应用唯一的资产数据形状定义（勿再使用已删除的 lib/asset-types.ts）。
 * - 扁平六大类：股票 / 基金 / ETF / 类现金 / 贵金属 / 自定义（数字货币、期货等）
 * - 场内：symbol、exchange、shares；国际持仓另有 intlQuoteSymbol（Stooq）与可选 figi/isin；价格分 markPrice（盘中现价）与 lastClose（日 K 结算）
 * - 可选 purpose / purposeTarget
 * - 可选 account（所在账户）、avgCost（场内成本单价）、costBasis（类现金等本金）
 */

import {
  defaultCurrencyForIntlListingExchange,
  isIntlListingExchange,
  isValidIntlStooqQuoteSymbol,
  INTL_LISTING_EXCHANGES,
  type IntlListingExchange,
} from '@/lib/intl-exchange-stooq';

/** 交易所：沪 / 深 / 北；OTC 为场外开放式基金（东财 secid 前缀 2） */
export type ChinaExchange = 'SH' | 'SZ' | 'BJ' | 'OTC';

export type { IntlListingExchange };
export { INTL_LISTING_EXCHANGES, isIntlListingExchange };

/** A 股/场外 + 国际场（Twelve Data 代理 或 OpenFIGI+Stooq）+ 上金现货（SGE） */
export type ListingExchange = ChinaExchange | IntlListingExchange | 'SGE';

/** 资产大类（存储与逻辑的唯一分类来源，不再单独存 type 字段） */
export const ASSET_CATEGORY_ORDER = [
  'Stock',
  'Fund',
  'ETF',
  'Cash',
  'Gold',
  'Custom',
] as const;

export type AssetCategory = (typeof ASSET_CATEGORY_ORDER)[number];

/** 贵金属现货品种（仅 category=Gold 时使用）；默认 XAU 兼容旧数据 */
export const PRECIOUS_METAL_SPOT_ORDER = ['XAU', 'XAG', 'XPT', 'XPD'] as const;
export type PreciousMetalSpot = (typeof PRECIOUS_METAL_SPOT_ORDER)[number];

export const PRECIOUS_METAL_LABEL_ZH: Record<PreciousMetalSpot, string> = {
  XAU: '黄金（XAU）',
  XAG: '白银（XAG）',
  XPT: '铂金（XPT）',
  XPD: '钯金（XPD）',
};

/** 界面展示用中文名 */
export const CATEGORY_LABEL_ZH: Record<AssetCategory, string> = {
  Stock: '股票',
  Fund: '基金',
  ETF: 'ETF',
  Cash: '类现金',
  Gold: '贵金属',
  Custom: '自定义',
};

/**
 * 是否「场内证券类」——需要代码、交易所、份额与行情的那几类。
 * 集中维护，避免在多个文件里写死 Stock|Fund|ETF。
 */
export function isListedAssetCategory(c: AssetCategory): boolean {
  return c === 'Stock' || c === 'Fund' || c === 'ETF';
}

/** 贵金属类别：按克记账，可不填证券代码 */
export function isGoldAssetCategory(c: AssetCategory): boolean {
  return c === 'Gold';
}

/** 会与「同代码」合并去重的类别：仅场内三类（贵金属无代码不参与按代码合并） */
export function isHeldMergeCategory(c: AssetCategory): boolean {
  return isListedAssetCategory(c);
}

/** 旧版 category + type → 新版扁平 AssetCategory */
export function migrateLegacyCategoryType(
  category: string,
  type: string
): AssetCategory {
  const flat: AssetCategory[] = [
    'Stock',
    'Fund',
    'ETF',
    'Cash',
    'Gold',
    'Custom',
  ];
  if (flat.includes(category as AssetCategory)) {
    return category as AssetCategory;
  }
  if (category === 'Other') {
    if (type === 'Gold') return 'Gold';
    return 'Cash';
  }
  if (
    category === 'ShortTermInvestment' ||
    category === 'LongTermInvestment'
  ) {
    if (type === 'Stock') return 'Stock';
    if (type === 'ETF') return 'ETF';
    if (type === 'Fund') return 'Fund';
    if (type === 'Deposit') return 'Cash';
    if (type === 'Gold') return 'Gold';
    return 'Stock';
  }
  return 'Cash';
}

/** 单条「某日资产市值」历史（用于编辑后追溯） */
export type AssetHistoryEntry = {
  date: string;
  value: number;
};

/** 场内加减仓流水（买卖均需记录单价）；贵金属时 shares 为克、单价为 CNY/克 */
export type TradeLedgerEntry = {
  id: string;
  /** YYYY-MM-DD */
  tradeDate: string;
  side: 'buy' | 'sell';
  shares: number;
  /** 成交单价（与资产报价币种一致；JSON 字段名 unitPriceCny 为历史兼容） */
  unitPriceCny: number;
  /** 可选：本笔买入的资金来源资产 id（如余额宝） */
  fundingSourceAssetId?: string;
  /** 可选：资金来源资产名称快照 */
  fundingSourceAssetName?: string;
  /** 可选：本笔卖出的资金去向资产 id（如余额宝、银行卡等类现金资产） */
  cashDestinationAssetId?: string;
  /** 可选：资金去向资产名称快照 */
  cashDestinationAssetName?: string;
  /** 可选：与现金流水联动的一笔转账 id */
  transferId?: string;
};

/** 类现金余额变动流水（仅金额，无单价） */
export type CashLedgerEntry = {
  id: string;
  /** YYYY-MM-DD */
  entryDate: string;
  side: 'in' | 'out';
  /** 变动金额，与资产币种一致，恒为正数 */
  amount: number;
  /** 可选：关联的目标资产 id（例如买入股票后现金扣减） */
  relatedAssetId?: string;
  /** 可选：关联目标资产名称快照 */
  relatedAssetName?: string;
  /** 可选：备注 */
  note?: string;
  /** 可选：与交易流水联动的一笔转账 id */
  transferId?: string;
};

/**
 * SimpleAsset：AsyncStorage 里一条资产的完整形状。
 * category 是唯一类别来源；已废弃的 type 字段在读盘时会被忽略，仅参与迁移推断。
 */
export type SimpleAsset = {
  id: string;
  name: string;
  value: number;
  category: AssetCategory;
  history?: AssetHistoryEntry[];
  /** 场内六位代码；美股/港股为行情所用语短码（如 AAPL、700） */
  symbol?: string;
  exchange?: ListingExchange;
  /** 东财 push2/K 线用 secid（联想 QuoteID，如 1.600519、150.012922；贵金属现货可为 118.AU9999）；有则优先于 exchange+symbol 推导 */
  emSecid?: string;
  /**
   * 国际收盘价来源：Stooq 符号，如 `aapl.us`、`700.hk`、`vod.l`（与东财体系互斥）。
   * 由联想映射得到；Twelve Data 模式下仍会写入以便展示与 legacy 兜底。
   */
  intlQuoteSymbol?: string;
  /**
   * Twelve Data 报价键（经 Vercel 代理）：与 `twelveDataMic` 成对出现。
   * 有值且配置了 `EXPO_PUBLIC_MARKET_PROXY_ORIGIN` 时，刷新/参考价优先走 Twelve。
   */
  twelveDataSymbol?: string;
  /** ISO 10383 MIC，如 XNAS、XHKG */
  twelveDataMic?: string;
  /** OpenFIGI 返回的 FIGI（可选，便于换行情源时映射） */
  figi?: string;
  /** ISIN ISO 6166（可选） */
  isin?: string;
  /**
   * 贵金属现货品种（仅 category=Gold）。
   * 若同时有 emSecid（上金现货合约），行情以 push2 该 secid 为准；否则按品种走参考价逻辑。
   */
  preciousMetalSpot?: PreciousMetalSpot;
  shares?: number;
  /** 日 K 结算价（来自 K 线接口，语义为「收盘价/结算价」） */
  lastClose?: number;
  /** lastClose 对应的交易日（K 线日期） */
  lastCloseDate?: string;
  /** push2 最新价/现价（盘中刷新），与 lastClose 分离 */
  markPrice?: number;
  /** markPrice 对应的上海日历日（记录是哪一天抓到的现价） */
  markPriceDate?: string;
  currency?: string;
  /** 所在账户，如支付宝、招商银行储蓄卡、同花顺 */
  account?: string;
  /**
   * 场内：持仓平均成本单价（与报价币种一致：A 股为 CNY/份，美股多为 USD/份等）。
   * 贵金属：购买均价（CNY/克）。
   * 类现金：可不填；也可用 costBasis 表示本金。
   */
  avgCost?: number;
  /** 类现金等：可选总本金/成本（与当前市值分开时使用） */
  costBasis?: number;
  purpose?: string;
  purposeTarget?: number;
  /** 场内：加减仓流水；编辑/删除流水后会重算 shares / avgCost */
  tradeHistory?: TradeLedgerEntry[];
  /** 类现金：增加/减少流水，重算 value */
  cashLedger?: CashLedgerEntry[];
  /**
   * 类现金 / 自定义：可选资金来源（新增或余额增加时从此类现金资产扣款；选填）。
   */
  cashFundingSourceAssetId?: string;
  cashFundingSourceAssetName?: string;
  /** 与资金来源账户上「划入本资产」扣款流水对应的 transferId（编辑信息里补选/更换资金来源时用） */
  cashFundingSourceTransferId?: string;
};

export function generateAssetId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 流水 JSON 里份额、单价可能被存成字符串，读盘时统一成 number */
function coerceLedgerShares(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim().replace(/,/g, ''));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function coerceLedgerUnitPrice(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw >= 0) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim().replace(/,/g, ''));
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return null;
}

function parseTradeHistoryRaw(raw: unknown): TradeLedgerEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: TradeLedgerEntry[] = [];
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null;
    const tradeDate =
      typeof o.tradeDate === 'string' && o.tradeDate.length > 0
        ? o.tradeDate
        : null;
    const side = o.side === 'buy' || o.side === 'sell' ? o.side : null;
    const shares = coerceLedgerShares(o.shares);
    const unitPriceCny = coerceLedgerUnitPrice(o.unitPriceCny);
    if (id && tradeDate && side && shares !== null && unitPriceCny !== null) {
      const e: TradeLedgerEntry = { id, tradeDate, side, shares, unitPriceCny };
      if (
        typeof o.fundingSourceAssetId === 'string' &&
        o.fundingSourceAssetId.length > 0
      ) {
        e.fundingSourceAssetId = o.fundingSourceAssetId;
      }
      if (
        typeof o.fundingSourceAssetName === 'string' &&
        o.fundingSourceAssetName.length > 0
      ) {
        e.fundingSourceAssetName = o.fundingSourceAssetName;
      }
      if (typeof o.transferId === 'string' && o.transferId.length > 0) {
        e.transferId = o.transferId;
      }
      if (
        typeof o.cashDestinationAssetId === 'string' &&
        o.cashDestinationAssetId.length > 0
      ) {
        e.cashDestinationAssetId = o.cashDestinationAssetId;
      }
      if (
        typeof o.cashDestinationAssetName === 'string' &&
        o.cashDestinationAssetName.length > 0
      ) {
        e.cashDestinationAssetName = o.cashDestinationAssetName;
      }
      out.push(e);
    }
  }
  return out.length > 0 ? out : undefined;
}

function coerceCashLedgerAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) return raw;
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim().replace(/,/g, ''));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function parseCashLedgerRaw(raw: unknown): CashLedgerEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CashLedgerEntry[] = [];
  for (const x of raw) {
    if (typeof x !== 'object' || x === null) continue;
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : null;
    const entryDate =
      typeof o.entryDate === 'string' && o.entryDate.length > 0
        ? o.entryDate
        : typeof o.tradeDate === 'string' && o.tradeDate.length > 0
          ? o.tradeDate
          : null;
    const side = o.side === 'in' || o.side === 'out' ? o.side : null;
    const amount = coerceCashLedgerAmount(o.amount);
    if (id && entryDate && side && amount !== null) {
      const e: CashLedgerEntry = { id, entryDate, side, amount };
      if (typeof o.relatedAssetId === 'string' && o.relatedAssetId.length > 0) {
        e.relatedAssetId = o.relatedAssetId;
      }
      if (
        typeof o.relatedAssetName === 'string' &&
        o.relatedAssetName.length > 0
      ) {
        e.relatedAssetName = o.relatedAssetName;
      }
      if (typeof o.note === 'string' && o.note.length > 0) {
        e.note = o.note;
      }
      if (typeof o.transferId === 'string' && o.transferId.length > 0) {
        e.transferId = o.transferId;
      }
      out.push(e);
    }
  }
  return out.length > 0 ? out : undefined;
}

/** 读盘时兼容 JSON 里 shares 被写成字符串的情况 */
function coercePositiveShares(raw: unknown): number | undefined {
  if (typeof raw === 'number' && !Number.isNaN(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string') {
    const n = parseFloat(raw.trim().replace(/,/g, ''));
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return undefined;
}

/** 列出资产用于估值的有效单价：优先盘中现价，否则用日 K 结算价 */
export function getListedUnitPrice(a: SimpleAsset): number | null {
  if (typeof a.markPrice === 'number' && a.markPrice > 0) return a.markPrice;
  if (typeof a.lastClose === 'number' && a.lastClose > 0) return a.lastClose;
  return null;
}

/**
 * 从存储原始 JSON 读出并规范化：
 * - 迁移旧分类、补齐 category
 * - 丢弃重复字段 type（若存在仅用于迁移）
 * - 场内证券：有完整代码与交易所时，用 markPrice 或 lastClose 重算 value
 * - 贵金属：有克数时，优先用参考单价算市值；无单价则用 avgCost（CNY/克）估算
 */
export function ensureAsset(raw: unknown): SimpleAsset {
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === 'string' && o.id.length > 0
      ? o.id
      : generateAssetId();
  const name = typeof o.name === 'string' ? o.name : '';
  const rawCat = typeof o.category === 'string' ? o.category : 'Cash';
  const rawType = typeof o.type === 'string' ? o.type : '';
  let category = migrateLegacyCategoryType(rawCat, rawType);
  if (!ASSET_CATEGORY_ORDER.includes(category as AssetCategory)) {
    category = 'Cash';
  }

  const shares = coercePositiveShares(o.shares);
  const symbolRaw = typeof o.symbol === 'string' ? o.symbol.trim() : '';
  const symbol = symbolRaw.length > 0 ? symbolRaw : undefined;
  let exchange: ListingExchange | undefined;
  if (typeof o.exchange === 'string') {
    const ex = o.exchange;
    if (isIntlListingExchange(ex)) {
      exchange = ex;
    } else if (
      ex === 'SH' ||
      ex === 'SZ' ||
      ex === 'BJ' ||
      ex === 'OTC' ||
      ex === 'SGE'
    ) {
      exchange = ex;
    }
  }
  const emSecidRaw = typeof o.emSecid === 'string' ? o.emSecid.trim() : '';
  const emSecid =
    emSecidRaw.length > 0 && /^\d+\.\d+$/.test(emSecidRaw)
      ? emSecidRaw
      : undefined;
  const intlRaw = typeof o.intlQuoteSymbol === 'string' ? o.intlQuoteSymbol.trim() : '';
  const intlQuoteSymbol =
    intlRaw.length > 0 && isValidIntlStooqQuoteSymbol(intlRaw)
      ? intlRaw.toLowerCase()
      : undefined;
  const twelveSymRaw =
    typeof o.twelveDataSymbol === 'string' ? o.twelveDataSymbol.trim() : '';
  const twelveMicRaw =
    typeof o.twelveDataMic === 'string' ? o.twelveDataMic.trim().toUpperCase() : '';
  const twelveDataSymbol =
    twelveSymRaw.length > 0 && twelveSymRaw.length <= 32 ? twelveSymRaw : undefined;
  const twelveDataMic =
    twelveMicRaw.length > 0 && /^[A-Z0-9]{3,12}$/.test(twelveMicRaw)
      ? twelveMicRaw
      : undefined;
  const figiRaw = typeof o.figi === 'string' ? o.figi.trim().toUpperCase() : '';
  const figi =
    figiRaw.length >= 8 && figiRaw.length <= 14 && /^[A-Z0-9]+$/.test(figiRaw)
      ? figiRaw
      : undefined;
  const isinRaw = typeof o.isin === 'string' ? o.isin.trim().toUpperCase() : '';
  const isin =
    /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isinRaw) ? isinRaw : undefined;
  const pmRaw =
    typeof o.preciousMetalSpot === 'string'
      ? o.preciousMetalSpot.trim().toUpperCase()
      : '';
  const preciousMetalSpot = PRECIOUS_METAL_SPOT_ORDER.includes(
    pmRaw as PreciousMetalSpot
  )
    ? (pmRaw as PreciousMetalSpot)
    : undefined;
  const lastClose =
    typeof o.lastClose === 'number' && !Number.isNaN(o.lastClose)
      ? o.lastClose
      : undefined;
  const lastCloseDate =
    typeof o.lastCloseDate === 'string' ? o.lastCloseDate : undefined;
  const markPrice =
    typeof o.markPrice === 'number' && !Number.isNaN(o.markPrice)
      ? o.markPrice
      : undefined;
  const markPriceDate =
    typeof o.markPriceDate === 'string' ? o.markPriceDate : undefined;
  const currency =
    typeof o.currency === 'string' && o.currency.length > 0
      ? o.currency
      : undefined;

  const accountRaw = typeof o.account === 'string' ? o.account.trim() : '';
  const account = accountRaw.length > 0 ? accountRaw : undefined;

  const avgCostRaw = o.avgCost;
  const avgCost =
    typeof avgCostRaw === 'number' &&
    !Number.isNaN(avgCostRaw) &&
    avgCostRaw > 0
      ? avgCostRaw
      : undefined;

  const costBasisRaw = o.costBasis;
  const costBasis =
    typeof costBasisRaw === 'number' &&
    !Number.isNaN(costBasisRaw) &&
    costBasisRaw >= 0
      ? costBasisRaw
      : undefined;

  const purposeRaw = typeof o.purpose === 'string' ? o.purpose.trim() : '';
  const purpose = purposeRaw.length > 0 ? purposeRaw : undefined;
  const pt =
    typeof o.purposeTarget === 'number' && !Number.isNaN(o.purposeTarget)
      ? o.purposeTarget
      : undefined;
  const purposeTarget =
    pt !== undefined && pt > 0 ? pt : undefined;

  let value = typeof o.value === 'number' && !Number.isNaN(o.value) ? o.value : 0;
  if (value === 0 && shares !== undefined && typeof o.price === 'number') {
    if (o.price > 0) {
      value = shares * o.price;
    }
  }

  let history: AssetHistoryEntry[] | undefined;
  if (Array.isArray(o.history)) {
    history = o.history
      .filter(
        (h: unknown): h is AssetHistoryEntry =>
          typeof h === 'object' &&
          h !== null &&
          typeof (h as AssetHistoryEntry).date === 'string' &&
          typeof (h as AssetHistoryEntry).value === 'number'
      )
      .slice();
    if (history.length === 0) history = undefined;
  }

  const asset: SimpleAsset = {
    id,
    name,
    value,
    category,
    ...(history && { history }),
  };
  if (shares !== undefined) asset.shares = shares;
  if (symbol) asset.symbol = symbol;
  if (exchange) asset.exchange = exchange;
  if (lastClose !== undefined) asset.lastClose = lastClose;
  if (lastCloseDate) asset.lastCloseDate = lastCloseDate;
  if (markPrice !== undefined && markPrice > 0) asset.markPrice = markPrice;
  if (markPriceDate) asset.markPriceDate = markPriceDate;
  if (emSecid) asset.emSecid = emSecid;
  if (intlQuoteSymbol) asset.intlQuoteSymbol = intlQuoteSymbol;
  if (twelveDataSymbol) asset.twelveDataSymbol = twelveDataSymbol;
  if (twelveDataMic) asset.twelveDataMic = twelveDataMic;
  if (figi) asset.figi = figi;
  if (isin) asset.isin = isin;
  if (preciousMetalSpot) asset.preciousMetalSpot = preciousMetalSpot;
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    asset.currency = currency;
  }
  if (purpose) asset.purpose = purpose;
  if (purposeTarget !== undefined) asset.purposeTarget = purposeTarget;
  if (account) asset.account = account;
  if (avgCost !== undefined) asset.avgCost = avgCost;
  if (costBasis !== undefined) asset.costBasis = costBasis;

  const th = parseTradeHistoryRaw(o.tradeHistory);
  if (th) asset.tradeHistory = th;

  const cl = parseCashLedgerRaw(o.cashLedger);
  if (cl) asset.cashLedger = cl;

  const cfsIdRaw =
    typeof o.cashFundingSourceAssetId === 'string'
      ? o.cashFundingSourceAssetId.trim()
      : '';
  const cfsNameRaw =
    typeof o.cashFundingSourceAssetName === 'string'
      ? o.cashFundingSourceAssetName.trim()
      : '';
  if (cfsIdRaw.length > 0) {
    asset.cashFundingSourceAssetId = cfsIdRaw;
    if (cfsNameRaw.length > 0) {
      asset.cashFundingSourceAssetName = cfsNameRaw;
    }
  }
  const cfsXferTid =
    typeof o.cashFundingSourceTransferId === 'string'
      ? o.cashFundingSourceTransferId.trim()
      : '';
  if (cfsXferTid.length > 0 && cfsIdRaw.length > 0) {
    asset.cashFundingSourceTransferId = cfsXferTid;
  }

  const sharesHeld =
    typeof asset.shares === 'number' && asset.shares > 0 ? asset.shares : null;

  const listedChinaComplete =
    isListedAssetCategory(asset.category) &&
    sharesHeld !== null &&
    typeof asset.symbol === 'string' &&
    /^\d{6}$/.test(asset.symbol) &&
    (asset.exchange === 'SH' ||
      asset.exchange === 'SZ' ||
      asset.exchange === 'BJ' ||
      asset.exchange === 'OTC');

  const hasIntlQuoteKey =
    typeof asset.intlQuoteSymbol === 'string' &&
    asset.intlQuoteSymbol.trim().length > 0;
  const hasTwelveQuoteKey =
    typeof asset.twelveDataSymbol === 'string' &&
    asset.twelveDataSymbol.trim().length > 0 &&
    typeof asset.twelveDataMic === 'string' &&
    asset.twelveDataMic.trim().length > 0;

  const listedIntlComplete =
    isListedAssetCategory(asset.category) &&
    sharesHeld !== null &&
    (hasIntlQuoteKey || hasTwelveQuoteKey) &&
    typeof asset.exchange === 'string' &&
    isIntlListingExchange(asset.exchange) &&
    typeof asset.symbol === 'string' &&
    asset.symbol.trim().length > 0;

  const unit = getListedUnitPrice(asset);
  if (
    (listedChinaComplete || listedIntlComplete) &&
    unit !== null &&
    sharesHeld !== null
  ) {
    asset.value = sharesHeld * unit;
  } else if (asset.category === 'Gold' && sharesHeld !== null) {
    if (unit !== null) {
      asset.value = sharesHeld * unit;
    }
  }

  if (typeof asset.currency !== 'string' || !/^[A-Z]{3}$/.test(asset.currency)) {
    if (asset.exchange && isIntlListingExchange(asset.exchange)) {
      asset.currency = defaultCurrencyForIntlListingExchange(asset.exchange);
    } else {
      asset.currency = 'CNY';
    }
  }

  return asset;
}
