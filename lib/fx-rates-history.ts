/**
 * 汇率历史：按上海日历日保留每日 USD 基准串联汇率表，供净值归因等与快照同日折算一致。
 * 与 lib/fx-rates.ts 中单条缓存 key 独立存储。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FxUsdMidRates } from '@/lib/fx-rates';

const HISTORY_KEY = 'fx_usd_mid_rates_history_v1';
/** 须与 lib/fx-rates.ts STORAGE_KEY 一致（仅用于冷启动回填） */
const LEGACY_SINGLE_CACHE_KEY = 'fx_usd_mid_rates_v1';

const MAX_ENTRIES = 800;

function isValidEntry(x: unknown): x is FxUsdMidRates {
  if (!x || typeof x !== 'object') return false;
  const o = x as Partial<FxUsdMidRates>;
  return (
    typeof o.shanghaiDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.shanghaiDate) &&
    typeof o.apiDate === 'string' &&
    o.rates != null &&
    typeof o.rates === 'object' &&
    typeof (o.rates as { CNY?: number }).CNY === 'number' &&
    (o.rates as { CNY: number }).CNY > 0
  );
}

async function loadRaw(): Promise<FxUsdMidRates[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(isValidEntry);
  } catch {
    return [];
  }
}

async function saveRaw(list: FxUsdMidRates[]): Promise<void> {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

/** 历史为空时，用旧版单条缓存回填一条，避免升级后全无历史 */
async function seedFromLegacyCacheIfEmpty(): Promise<void> {
  const cur = await loadRaw();
  if (cur.length > 0) return;
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SINGLE_CACHE_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as unknown;
    if (!isValidEntry(p)) return;
    await saveRaw([p]);
  } catch {
    /* ignore */
  }
}

/**
 * 读取全部汇率历史（上海日升序）。首次会尝试从单条缓存回填。
 */
export async function getFxUsdRatesHistory(): Promise<FxUsdMidRates[]> {
  await seedFromLegacyCacheIfEmpty();
  const list = await loadRaw();
  return [...list].sort((a, b) => a.shanghaiDate.localeCompare(b.shanghaiDate));
}

/**
 * 写入或覆盖某一上海日的汇率快照（通常在拉取到当日中间价成功后调用）。
 */
export async function upsertFxUsdRatesHistory(entry: FxUsdMidRates): Promise<void> {
  if (!isValidEntry(entry)) return;
  const list = await loadRaw();
  const idx = list.findIndex((x) => x.shanghaiDate === entry.shanghaiDate);
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  list.sort((a, b) => a.shanghaiDate.localeCompare(b.shanghaiDate));
  while (list.length > MAX_ENTRIES) {
    list.shift();
  }
  await saveRaw(list);
}

/**
 * 按上海日历日解析应用哪一套 rates：
 * 1) 该日有记录则用该日；
 * 2) 否则用「不晚于该日的最近一条」（历史上常见：周末沿用上一工作日）；
 * 3) 否则用「不早于该日的最早一条」；
 * 4) 全无则返回 null（由调用方再退回当前单条缓存）。
 */
export function createFxRatesResolver(
  history: FxUsdMidRates[],
  fallback: FxUsdMidRates['rates'] | null | undefined
): (date: string) => FxUsdMidRates['rates'] | null {
  const sorted = [...history]
    .filter((h) => h?.rates?.CNY > 0)
    .sort((a, b) => a.shanghaiDate.localeCompare(b.shanghaiDate));

  return (date: string): FxUsdMidRates['rates'] | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fallback && fallback.CNY > 0 ? fallback : null;
    }
    const exact = sorted.find((h) => h.shanghaiDate === date);
    if (exact) return exact.rates;
    const onOrBefore = sorted.filter((h) => h.shanghaiDate <= date);
    if (onOrBefore.length > 0) {
      return onOrBefore[onOrBefore.length - 1]!.rates;
    }
    const onOrAfter = sorted.find((h) => h.shanghaiDate >= date);
    if (onOrAfter) return onOrAfter.rates;
    return fallback && fallback.CNY > 0 ? fallback : null;
  };
}
