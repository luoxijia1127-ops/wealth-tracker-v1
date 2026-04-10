/**
 * 刷新行情 → 拉取/缓存当日汇率 → 按需写资产与日快照；
 * 若「今日快照」未折算或折算人民币合计变化再 upsert。
 */

import {
  getAssetCurrency,
  sumDisplayValuesInCny,
  sumDisplayValuesNaive,
} from '@/lib/asset-value';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  ensureFxUsdRatesForToday,
  ensureFxUsdRatesHistoryBackfill,
  type FxEnsureSource,
} from '@/lib/fx-rates';
import { refreshListedQuotes } from '@/lib/quote-refresh';
import { getSnapshots, saveSnapshot } from '@/lib/snapshots';
import { saveAssetDailySnapshot } from '@/lib/asset-daily-snapshots';
import type { SimpleAsset } from '@/types/asset';

const EPS = 1e-6;

export type SyncNetWorthResult = {
  assets: SimpleAsset[];
  totalNaive: number;
  /**
   * 折合人民币合计；无汇率且存在非人民币资产时为 null（避免把外币数值当 CNY）。
   * 无汇率且全为人民币持仓时等于 totalNaive。
   */
  totalValueCny: number | null;
  fxApiDate: string | null;
  fxSource: FxEnsureSource;
};

function assetsNeedFxConversion(assets: SimpleAsset[]): boolean {
  return assets.some((a) => getAssetCurrency(a) !== 'CNY');
}

export async function syncNetWorthFromMarket(): Promise<SyncNetWorthResult> {
  const assets = await refreshListedQuotes();
  const totalNaive = sumDisplayValuesNaive(assets);
  const needsFx = assetsNeedFxConversion(assets);
  const { rates: fx, source } = await ensureFxUsdRatesForToday();
  await ensureFxUsdRatesHistoryBackfill();
  const hasFx = fx != null && fx.rates.CNY > 0;
  const cnyFromFx = hasFx ? sumDisplayValuesInCny(assets, fx!.rates) : null;
  const totalValueCny =
    cnyFromFx !== null ? cnyFromFx : needsFx ? null : totalNaive;

  const snapshots = await getSnapshots();
  const today = getShanghaiDateString();
  const existing = snapshots.find((s) => s.date === today);
  const prevCny =
    existing && typeof existing.totalValueCny === 'number'
      ? existing.totalValueCny
      : null;
  const naiveDiff =
    !existing || Math.abs(existing.totalValue - totalNaive) > EPS;
  const cnyDiff =
    cnyFromFx !== null &&
    (prevCny === null || Math.abs(prevCny - cnyFromFx) > EPS);

  if (naiveDiff || cnyDiff) {
    await saveSnapshot(
      totalNaive,
      cnyFromFx !== null
        ? { totalValueCny: cnyFromFx, fxRateDate: fx!.apiDate }
        : undefined
    );
  }

  await saveAssetDailySnapshot(assets, today);

  return {
    assets,
    totalNaive,
    totalValueCny,
    fxApiDate: hasFx ? fx!.apiDate : null,
    fxSource: hasFx ? source : 'none',
  };
}
