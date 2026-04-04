/**
 * 上海黄金交易所现货品种：经东方财富 push2（secid 前缀 118）读取最新价。
 * 非上金所官方接口；与 App 内 A 股行情同源，便于统一维护。
 *
 * 默认合约代码与东财「行情中心-上海黄金现货」一致；可用 EXPO_PUBLIC_SGE_*_SECID 覆盖。
 */

import { fetchPush2LastPrice } from '@/lib/eastmoney-push';
import type { PreciousMetalSpot } from '@/types/asset';

/** 市场号 118 = 上海黄金交易所（东方财富） */
const SGE_MKT = '118';

function readEnvSecid(metal: PreciousMetalSpot): string | undefined {
  const key =
    metal === 'XAU'
      ? 'EXPO_PUBLIC_SGE_XAU_SECID'
      : metal === 'XAG'
        ? 'EXPO_PUBLIC_SGE_XAG_SECID'
        : metal === 'XPT'
          ? 'EXPO_PUBLIC_SGE_XPT_SECID'
          : 'EXPO_PUBLIC_SGE_XPD_SECID';
  try {
    const v = process.env[key];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  } catch {
    /* Metro */
  }
  return undefined;
}

/** 合约代码（不含市场前缀）；未配置则返回 null 表示不走 SGE */
const DEFAULT_CONTRACT: Record<PreciousMetalSpot, string | null> = {
  XAU: 'AU9999',
  XAG: 'AG9999',
  XPT: 'PT9995',
  /** 若东财无此合约，fetch 会失败并由 precious-metal-quote 回退 Stooq */
  XPD: 'PD9995',
};

export function buildSgeEastmoneySecid(metal: PreciousMetalSpot): string | null {
  const fromEnv = readEnvSecid(metal);
  if (fromEnv !== undefined) {
    if (/^\d+\..+$/.test(fromEnv)) return fromEnv;
    return `${SGE_MKT}.${fromEnv}`;
  }
  const code = DEFAULT_CONTRACT[metal];
  if (!code) return null;
  return `${SGE_MKT}.${code}`;
}

/**
 * @returns CNY/克；失败返回 null
 */
export async function fetchSgeCnyPerGramFromEastmoney(
  metal: PreciousMetalSpot,
  signal?: AbortSignal
): Promise<{ price: number; source: string } | null> {
  const secid = buildSgeEastmoneySecid(metal);
  if (!secid) return null;
  const q = await fetchPush2LastPrice(secid, signal);
  if (!q || !(q.price > 0)) return null;
  return { price: q.price, source: `eastmoney-sge:${secid}` };
}

/** 东财上金合约代码（如 AU9999）→ 贵金属品种，用于联动「品种」选项 */
export function preciousMetalSpotFromSgeContractCode(
  code: string
): PreciousMetalSpot | null {
  const u = code.trim().toUpperCase();
  if (u.includes('AU')) return 'XAU';
  if (u.includes('AG')) return 'XAG';
  if (u.includes('PT')) return 'XPT';
  if (u.includes('PD')) return 'XPD';
  return null;
}
