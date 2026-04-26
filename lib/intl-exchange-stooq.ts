/**
 * 国际场：OpenFIGI `exchCode` → 本 App 交易所枚举 + Stooq 小写后缀。
 * Stooq 符号形如 `vod.l`、`sap.de`；后缀白名单用于防注入。
 *
 * OpenFIGI 交易所码参考：https://www.openfigi.com/api
 * Stooq 国家后缀参考：https://stooq.com/t/?i=518（以站点为准，使用前请在样例上验证）
 */

/** 与 `types/asset.ts` 中 `ListingExchange` 国际部分一致（供 OpenFIGI 映射写入） */
export const INTL_LISTING_EXCHANGES = [
  'US',
  'HK',
  'LSE',
  'XETR',
  'XPAR',
  'XAMS',
  'XSWX',
  'XMIL',
  'BMEX',
  'XSTO',
  'XOSL',
  'XCSE',
  'XHEL',
  'XDUB',
] as const;

export type IntlListingExchange = (typeof INTL_LISTING_EXCHANGES)[number];

const INTL_LISTING_EXCHANGE_SET = new Set<string>(INTL_LISTING_EXCHANGES);

export function isIntlListingExchange(ex: string): ex is IntlListingExchange {
  return INTL_LISTING_EXCHANGE_SET.has(ex);
}

/** 与 `lib/openfigi-search.ts` 中美股集合保持一致 */
export const OPENFIGI_US_EXCH_CODES = new Set([
  'US',
  'UN',
  'UW',
  'UQ',
  'UP',
  'UF',
  'UA',
]);

/**
 * Stooq 行情 CSV 允许的 `intlQuoteSymbol` 后缀（不含点）。
 * 仅添加已核对可拉日/即期序列的后缀。
 */
export const INTL_STOOQ_SUFFIX_WHITELIST = new Set([
  'us',
  'hk',
  /** 英国 LSE（部分 ETC 在 `.l` 上无 q/l 报价，`.uk` 有） */
  'l',
  'uk',
  /** 德国 Xetra 等 */
  'de',
  /** 巴黎 Euronext */
  'pa',
  /** 米兰 */
  'mi',
  /** 阿姆斯特丹 Euronext */
  'as',
  /** 瑞士 SIX */
  'sw',
  /** 马德里 */
  'mc',
  /** 布鲁塞尔 */
  'br',
  /** 斯德哥尔摩 */
  'st',
  /** 奥斯陆 */
  'ol',
  /** 哥本哈根 */
  'co',
  /** 赫尔辛基 */
  'he',
  /** 都柏林 */
  'i',
]);

/** `ticker.suffix` 全串校验（suffix 须在白名单） */
export function isValidIntlStooqQuoteSymbol(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!/^[a-z0-9.\-]+\.[a-z]{1,4}$/.test(s)) return false;
  const suffix = s.slice(s.lastIndexOf('.') + 1);
  return INTL_STOOQ_SUFFIX_WHITELIST.has(suffix);
}

/** 联想结果 / 存储用的 `intlQuoteSymbol`（小写） */
export function buildIntlStooqSymbol(ticker: string, stooqSuffix: string): string {
  const suf = stooqSuffix.trim().toLowerCase();
  let base = ticker.trim().toLowerCase();
  base = base.replace(/\./g, '-');
  const sufWithDot = `.${suf}`;
  if (base.endsWith(sufWithDot)) {
    base = base.slice(0, -sufWithDot.length);
  }
  return `${base}.${suf}`;
}

type OpenfigiVenueRow = {
  venue: IntlListingExchange;
  stooqSuffix: string;
};

/**
 * OpenFIGI search 返回行的 `exchCode` → 本 App 交易所 + Stooq 后缀。
 * 未覆盖的交易所返回 null（不进入联想）。
 */
export function openfigiExchCodeToVenueAndSuffix(
  exchCode: string
): OpenfigiVenueRow | null {
  const ex = exchCode.trim().toUpperCase();
  if (ex === 'HK') return { venue: 'HK', stooqSuffix: 'hk' };
  if (OPENFIGI_US_EXCH_CODES.has(ex)) return { venue: 'US', stooqSuffix: 'us' };

  const map: Record<string, OpenfigiVenueRow> = {
    L: { venue: 'LSE', stooqSuffix: 'l' },
    LN: { venue: 'LSE', stooqSuffix: 'l' },
    PA: { venue: 'XPAR', stooqSuffix: 'pa' },
    FP: { venue: 'XPAR', stooqSuffix: 'pa' },
    DE: { venue: 'XETR', stooqSuffix: 'de' },
    GR: { venue: 'XETR', stooqSuffix: 'de' },
    XF: { venue: 'XETR', stooqSuffix: 'de' },
    BE: { venue: 'XETR', stooqSuffix: 'de' },
    DU: { venue: 'XETR', stooqSuffix: 'de' },
    MU: { venue: 'XETR', stooqSuffix: 'de' },
    HA: { venue: 'XETR', stooqSuffix: 'de' },
    IM: { venue: 'XMIL', stooqSuffix: 'mi' },
    MI: { venue: 'XMIL', stooqSuffix: 'mi' },
    NA: { venue: 'XAMS', stooqSuffix: 'as' },
    AS: { venue: 'XAMS', stooqSuffix: 'as' },
    SS: { venue: 'XSWX', stooqSuffix: 'sw' },
    SW: { venue: 'XSWX', stooqSuffix: 'sw' },
    MC: { venue: 'BMEX', stooqSuffix: 'mc' },
    SM: { venue: 'BMEX', stooqSuffix: 'mc' },
    BR: { venue: 'XAMS', stooqSuffix: 'br' },
    ST: { venue: 'XSTO', stooqSuffix: 'st' },
    OL: { venue: 'XOSL', stooqSuffix: 'ol' },
    CO: { venue: 'XCSE', stooqSuffix: 'co' },
    HE: { venue: 'XHEL', stooqSuffix: 'he' },
    IR: { venue: 'XDUB', stooqSuffix: 'i' },
    ID: { venue: 'XDUB', stooqSuffix: 'i' },
  };
  return map[ex] ?? null;
}

/** 各国际场默认报价币种（与成本/市值展示一致） */
export function defaultCurrencyForIntlListingExchange(
  ex: IntlListingExchange
): string {
  switch (ex) {
    case 'US':
      return 'USD';
    case 'HK':
      return 'HKD';
    case 'LSE':
      return 'GBP';
    case 'XSWX':
      return 'CHF';
    case 'XSTO':
      return 'SEK';
    case 'XOSL':
      return 'NOK';
    case 'XCSE':
      return 'DKK';
    case 'XETR':
    case 'XPAR':
    case 'XAMS':
    case 'XMIL':
    case 'BMEX':
    case 'XHEL':
    case 'XDUB':
      return 'EUR';
    default:
      return 'USD';
  }
}

/**
 * 无 `intlQuoteSymbol` 时，用代码 + 默认 Stooq 后缀拼展示串（小写，如 `aapl.us`）。
 * 与 `buildIntlStooqSymbol` / 各市场主后缀一致；个别交易所存在多后缀时以常见主后缀为准。
 */
export const INTL_VENUE_DEFAULT_STOOQ_SUFFIX: Record<IntlListingExchange, string> = {
  US: 'us',
  HK: 'hk',
  LSE: 'l',
  XETR: 'de',
  XPAR: 'pa',
  XAMS: 'as',
  XSWX: 'sw',
  XMIL: 'mi',
  BMEX: 'mc',
  XSTO: 'st',
  XOSL: 'ol',
  XCSE: 'co',
  XHEL: 'he',
  XDUB: 'i',
};
