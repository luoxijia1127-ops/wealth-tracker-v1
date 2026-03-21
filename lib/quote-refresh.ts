/**
 * 行情刷新：场内标的并行 push2 + 日 K；场外开放式基金走 F10 单位净值（push2 常无有效 f43）。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import { fetchDailySettlementClose } from '@/lib/eastmoney-kline';
import { fetchOtcFundLatestNav } from '@/lib/eastmoney-fund-nav';
import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import { toEastMoneySecid } from '@/lib/eastmoney-secid';
import { getAssets, saveAssets } from '@/lib/asset-storage';
import { getListedUnitPrice, type SimpleAsset } from '@/types/asset';
import { isListedChineseAsset } from '@/lib/asset-value';

function listedEastMoneySecid(a: SimpleAsset): string {
  const raw = typeof a.emSecid === 'string' ? a.emSecid.trim() : '';
  if (raw.length > 0 && /^\d+\.\d+$/.test(raw)) return raw;
  return toEastMoneySecid(a.exchange!, a.symbol!.trim());
}

/**
 * 合并 push2 / 日 K 结果：先写入 markPrice、lastClose 字段；
 * 再用 getListedUnitPrice（现价优先）算市值；若无单价则只更新字段、不动 value。
 */
function mergeListedQuotes(
  a: SimpleAsset,
  push: Awaited<ReturnType<typeof fetchPush2LastPrice>>,
  kline: Awaited<ReturnType<typeof fetchDailySettlementClose>>
): SimpleAsset {
  let markPrice = a.markPrice;
  let markPriceDate = a.markPriceDate;
  if (push && push.price > 0) {
    markPrice = push.price;
    markPriceDate = getShanghaiDateString();
  }
  let lastClose = a.lastClose;
  let lastCloseDate = a.lastCloseDate;
  if (kline) {
    lastClose = kline.close;
    lastCloseDate = kline.tradeDate;
  }
  const next: SimpleAsset = {
    ...a,
    markPrice,
    markPriceDate,
    lastClose,
    lastCloseDate,
  };
  const unit = getListedUnitPrice(next);
  if (unit !== null && typeof a.shares === 'number') {
    return {
      ...next,
      value: a.shares * unit,
      currency: 'CNY',
    };
  }
  return next;
}

/** 浅比较：整表 JSON 一致则认为无需写盘（顺序与 getAssets 一致） */
function assetsJsonEqual(a: SimpleAsset[], b: SimpleAsset[]): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export async function refreshListedQuotes(): Promise<SimpleAsset[]> {
  const assets = await getAssets();
  const listed = assets.filter(isListedChineseAsset);
  if (listed.length === 0) return assets;

  const uniqueSecids = [...new Set(listed.map(listedEastMoneySecid))];

  const secidPack = new Map<
    string,
    {
      push: Awaited<ReturnType<typeof fetchPush2LastPrice>>;
      kline: Awaited<ReturnType<typeof fetchDailySettlementClose>>;
    }
  >();

  await Promise.all(
    uniqueSecids.map(async (secid) => {
      const sample = listed.find((a) => listedEastMoneySecid(a) === secid);
      try {
        if (sample?.exchange === 'OTC' && sample.symbol) {
          const nav = await fetchOtcFundLatestNav(sample.symbol.trim());
          if (nav) {
            secidPack.set(secid, {
              push: { price: nav.close },
              kline: {
                close: nav.close,
                tradeDate: nav.tradeDate,
              },
            });
          } else {
            secidPack.set(secid, { push: null, kline: null });
          }
          return;
        }
        const [push, kline] = await Promise.all([
          fetchPush2LastPrice(secid),
          fetchDailySettlementClose(secid),
        ]);
        secidPack.set(secid, { push, kline });
      } catch {
        secidPack.set(secid, { push: null, kline: null });
      }
    })
  );

  const next = assets.map((a) => {
    if (!isListedChineseAsset(a)) return a;
    const secid = listedEastMoneySecid(a);
    const pack = secidPack.get(secid);
    if (!pack) return a;
    return mergeListedQuotes(a, pack.push, pack.kline);
  });

  if (!assetsJsonEqual(assets, next)) {
    await saveAssets(next);
  }
  return next;
}
