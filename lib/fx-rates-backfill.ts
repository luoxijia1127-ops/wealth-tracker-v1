/**
 * 从 Frankfurter 拉取「起止日期」时间序列，回填本地汇率历史，便于新用户首日即可看到近一月走势。
 * @see https://frankfurter.dev — `/{start}..{end}?from=USD&to=...`
 */

import { FRANKFURTER_TO_CURRENCIES } from '@/lib/asset-currency';
import { ENDPOINTS } from '@/lib/config/endpoints';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import type { FxUsdMidRates } from '@/lib/fx-rates';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import {
  getFxUsdRatesHistory,
  upsertFxUsdRatesHistory,
} from '@/lib/fx-rates-history';

let inFlight: Promise<{
  ok: boolean;
  merged: number;
  skipped: boolean;
}> | null = null;

/** 旧数据兼容：至少 CNY/EUR/HKD 有效才视为可参与走势的交易日 */
function hasCoreRates(r: FxUsdMidRates['rates']): boolean {
  return (
    typeof r.CNY === 'number' &&
    r.CNY > 0 &&
    typeof r.EUR === 'number' &&
    r.EUR > 0 &&
    typeof r.HKD === 'number' &&
    r.HKD > 0
  );
}

/** 与当前 Frankfurter `to` 列表一致；用于判断「近一月」是否已回填完整，避免旧版仅三币种时误判为已充分 */
function hasFullFrankfurterRow(r: FxUsdMidRates['rates']): boolean {
  if (!hasCoreRates(r)) return false;
  return FRANKFURTER_TO_CURRENCIES.every((code) => {
    const v = r[code as keyof typeof r];
    return typeof v === 'number' && (v as number) > 0;
  });
}

/**
 * 若近 windowDays 天内已有足够「含 CNY/EUR/HKD」的交易日记录则跳过网络；
 * 否则请求 Frankfurter 时间序列并 upsert 到本地历史。
 */
export async function ensureFxUsdRatesHistoryBackfill(options?: {
  windowDays?: number;
  /** 窗口内已有不少于该天数则视为已回填充分 */
  minExistingTradingDays?: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; merged: number; skipped: boolean }> {
  if (inFlight) return inFlight;

  const windowDays = options?.windowDays ?? 30;
  const minExisting = options?.minExistingTradingDays ?? 14;

  const run = async (): Promise<{
    ok: boolean;
    merged: number;
    skipped: boolean;
  }> => {
    const today = getShanghaiDateString();
    const windowStart = addCalendarDaysYmd(today, -windowDays);

    const history = await getFxUsdRatesHistory();
    const inWindow = history.filter(
      (h) => h.shanghaiDate >= windowStart && h.shanghaiDate <= today
    );
    const complete = inWindow.filter((h) => hasFullFrankfurterRow(h.rates));
    if (complete.length >= minExisting) {
      return { ok: true, merged: 0, skipped: true };
    }

    const base = ENDPOINTS.frankfurterFxOrigin.replace(/\/$/, '');
    const url = `${base}/${windowStart}..${today}?from=USD&to=${FRANKFURTER_TO_CURRENCIES.join(',')}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: options?.signal,
      });
      if (!res.ok) return { ok: false, merged: 0, skipped: false };

      const j = (await res.json()) as {
        rates?: Record<string, Record<string, number>>;
      };
      const byDate = j.rates;
      if (!byDate || typeof byDate !== 'object') {
        return { ok: false, merged: 0, skipped: false };
      }

      let merged = 0;
      for (const [dateStr, day] of Object.entries(byDate)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
        if (!day || typeof day !== 'object') continue;
        const dr = day as Record<string, number>;
        const rates = {
          ...dr,
          USD: 1,
        } as unknown as FxUsdMidRates['rates'];
        if (!hasCoreRates(rates)) continue;

        const entry: FxUsdMidRates = {
          shanghaiDate: dateStr,
          apiDate: dateStr,
          rates,
        };
        await upsertFxUsdRatesHistory(entry);
        merged++;
      }
      return { ok: true, merged, skipped: false };
    } catch {
      return { ok: false, merged: 0, skipped: false };
    }
  };

  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
