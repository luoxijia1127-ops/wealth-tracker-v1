/**
 * 从 Frankfurter 拉取「起止日期」时间序列，回填本地汇率历史，便于新用户首日即可看到近一月走势。
 * @see https://frankfurter.dev — `/{start}..{end}?from=USD&to=...`
 */

import { ENDPOINTS } from '@/lib/config/endpoints';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import type { FxUsdMidRates } from '@/lib/fx-rates';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import {
  getFxUsdRatesHistory,
  upsertFxUsdRatesHistory,
} from '@/lib/fx-rates-history';

/** 与走势图所需一致（美元由 1/r 推导，不必向 API 要 USD 字段） */
const TRIO = ['CNY', 'EUR', 'HKD'] as const;

let inFlight: Promise<{
  ok: boolean;
  merged: number;
  skipped: boolean;
}> | null = null;

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
    const complete = inWindow.filter((h) => hasCoreRates(h.rates));
    if (complete.length >= minExisting) {
      return { ok: true, merged: 0, skipped: true };
    }

    const base = ENDPOINTS.frankfurterFxOrigin.replace(/\/$/, '');
    const url = `${base}/${windowStart}..${today}?from=USD&to=${TRIO.join(',')}`;

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
        const cny = day.CNY;
        const eur = day.EUR;
        const hkd = day.HKD;
        if (
          typeof cny !== 'number' ||
          !(cny > 0) ||
          typeof eur !== 'number' ||
          !(eur > 0) ||
          typeof hkd !== 'number' ||
          !(hkd > 0)
        ) {
          continue;
        }

        const entry: FxUsdMidRates = {
          shanghaiDate: dateStr,
          apiDate: dateStr,
          rates: {
            ...day,
            CNY: cny,
            USD: 1,
          } as FxUsdMidRates['rates'],
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
