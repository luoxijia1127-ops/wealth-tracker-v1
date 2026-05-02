/**
 * 外汇中间价：以 Frankfurter（ECB 口径）USD 基准串联折算人民币。
 * 当日按上海日历日缓存；网络失败时使用最近一次缓存。
 *
 * 可通过 EXPO_PUBLIC_FX_URL 覆盖默认 API（须返回与 Frankfurter 相同 JSON 形状）。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS } from '@/lib/config/endpoints';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { upsertFxUsdRatesHistory } from '@/lib/fx-rates-history';
import { fetchWithTimeout } from '@/lib/net/fetch-with-timeout';

const STORAGE_KEY = 'fx_usd_mid_rates_v1';

export type FxUsdMidRates = {
  /** 写入缓存时的上海日历日 */
  shanghaiDate: string;
  /** 接口返回的汇率日期（多为前一工作日） */
  apiDate: string;
  /** from=USD：1 USD = rates.CNY CNY、1 USD = rates.EUR EUR、… */
  rates: Record<string, number> & { CNY: number };
};

function fxUrl(): string {
  return ENDPOINTS.frankfurterFx;
}

/**
 * 将「原币种市值」折为人民币。usdRates 为 Frankfurter from=USD 的 rates。
 */
export function convertDisplayValueToCny(
  amount: number,
  currency: string,
  usdRates: FxUsdMidRates['rates']
): number {
  if (!Number.isFinite(amount)) return 0;
  const code = /^[A-Z]{3}$/.test(currency) ? currency : 'CNY';
  if (code === 'CNY') return amount;
  const cnyPerUsd = usdRates.CNY;
  if (!(cnyPerUsd > 0)) return amount;
  if (code === 'USD') return amount * cnyPerUsd;
  const foreignPerUsd = usdRates[code];
  if (!(foreignPerUsd > 0)) return amount;
  const usd = amount / foreignPerUsd;
  return usd * cnyPerUsd;
}

/**
 * 任意 ISO 币种 → 目标币种（经 USD 串联，与 Frankfurter `rates` 语义一致）。
 * 缺少有效汇率时返回 NaN。
 */
/**
 * 汇率缓存是否含至少一种「1 USD = X 外币」报价，可用于经 USD 串联折算。
 * （勿再用仅 `CNY>0` 判断，否则默认展示货币为 GBP 等时会把合法缓存判为无效。）
 */
export function hasUsdAnchoredFxTable(
  usdRates: FxUsdMidRates['rates'] | null | undefined
): boolean {
  if (!usdRates || typeof usdRates !== 'object') return false;
  return Object.entries(usdRates).some(
    ([k, v]) =>
      /^[A-Z]{3}$/.test(k) &&
      k !== 'USD' &&
      typeof v === 'number' &&
      v > 0
  );
}

export function convertDisplayValueToCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  usdRates: FxUsdMidRates['rates']
): number {
  if (!Number.isFinite(amount)) return NaN;
  const from = /^[A-Z]{3}$/.test(fromCurrency) ? fromCurrency : 'CNY';
  const to = /^[A-Z]{3}$/.test(toCurrency) ? toCurrency : 'CNY';
  if (from === to) return amount;
  let usd: number;
  if (from === 'USD') {
    usd = amount;
  } else {
    const rFrom = usdRates[from];
    if (!(typeof rFrom === 'number' && rFrom > 0)) return NaN;
    usd = amount / rFrom;
  }
  if (to === 'USD') return usd;
  const rTo = usdRates[to];
  if (!(typeof rTo === 'number' && rTo > 0)) return NaN;
  return usd * rTo;
}

export async function getCachedFxUsdRates(): Promise<FxUsdMidRates | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<FxUsdMidRates>;
    if (
      p &&
      typeof p.shanghaiDate === 'string' &&
      typeof p.apiDate === 'string' &&
      p.rates &&
      typeof p.rates.CNY === 'number' &&
      p.rates.CNY > 0
    ) {
      return p as FxUsdMidRates;
    }
    return null;
  } catch {
    return null;
  }
}

async function saveCachedFxUsdRates(data: FxUsdMidRates): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  notifyFxRates(data);
}

const fxRatesListeners = new Set<(rates: FxUsdMidRates) => void>();

/** 订阅当日汇率缓存写入；回调收到的是写入后的最新值。返回取消订阅函数。 */
export function subscribeFxRates(
  listener: (rates: FxUsdMidRates) => void
): () => void {
  fxRatesListeners.add(listener);
  return () => {
    fxRatesListeners.delete(listener);
  };
}

function notifyFxRates(rates: FxUsdMidRates): void {
  fxRatesListeners.forEach((cb) => {
    try {
      cb(rates);
    } catch {
      /* listener 异常不影响其它订阅者 */
    }
  });
}

export type FxEnsureSource = 'network' | 'cache' | 'stale' | 'none';

/**
 * 当日优先读缓存；否则请求网络；失败则返回最近一次缓存（stale）。
 */
export async function ensureFxUsdRatesForToday(): Promise<{
  rates: FxUsdMidRates | null;
  source: FxEnsureSource;
}> {
  const today = getShanghaiDateString();
  const cached = await getCachedFxUsdRates();
  if (cached && cached.shanghaiDate === today) {
    return { rates: cached, source: 'cache' };
  }
  try {
    const res = await fetchWithTimeout(fxUrl(), {
      headers: { Accept: 'application/json' },
      timeoutMs: 8000,
    });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const rates = j.rates;
    const apiDate = typeof j.date === 'string' && j.date.length >= 8 ? j.date : today;
    if (!rates || typeof rates.CNY !== 'number' || !(rates.CNY > 0)) {
      throw new Error('fx parse');
    }
    const next: FxUsdMidRates = {
      shanghaiDate: today,
      apiDate,
      rates: { ...rates, CNY: rates.CNY },
    };
    await saveCachedFxUsdRates(next);
    void upsertFxUsdRatesHistory(next);
    return { rates: next, source: 'network' };
  } catch {
    if (cached) {
      void upsertFxUsdRatesHistory(cached);
      return { rates: cached, source: 'stale' };
    }
    return { rates: null, source: 'none' };
  }
}

/**
 * 类现金账本为人民币时：将「按证券报价币种计的买入/卖出总额」折为应从现金扣减或增加的人民币金额。
 */
export async function convertListingCostToCnyCashDebit(
  amount: number,
  listingCurrency: string
): Promise<{ ok: true; cny: number } | { ok: false; message: string }> {
  if (!(amount > 0) || Number.isNaN(amount)) {
    return { ok: false, message: '金额须为正数。' };
  }
  const code = /^[A-Z]{3}$/.test(listingCurrency) ? listingCurrency : 'CNY';
  if (code === 'CNY') {
    return { ok: true, cny: amount };
  }
  const { rates } = await ensureFxUsdRatesForToday();
  if (!rates) {
    return {
      ok: false,
      message:
        '无法获取汇率，无法与人民币现金账户联动。请稍后再试，或不选资金来源/去向。',
    };
  }
  const cny = convertDisplayValueToCny(amount, code, rates.rates);
  if (!Number.isFinite(cny) || cny <= 0) {
    return { ok: false, message: '折算人民币金额无效。' };
  }
  return { ok: true, cny };
}

export {
  createFxRatesResolver,
  getFxUsdRatesHistory,
  upsertFxUsdRatesHistory,
} from '@/lib/fx-rates-history';

export { ensureFxUsdRatesHistoryBackfill } from '@/lib/fx-rates-backfill';
