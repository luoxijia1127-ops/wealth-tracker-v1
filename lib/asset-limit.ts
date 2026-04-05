/**
 * 主列表资产数量与订阅权益：免费最多 FREE_ASSET_LIMIT 条，会员无限制。
 */

import { getAssets } from '@/lib/asset-storage';
import { getIsProEntitlementActive } from '@/lib/revenuecat';
import {
  FREE_ASSET_LIMIT,
} from '@/lib/subscription-constants';

export { FREE_ASSET_LIMIT } from '@/lib/subscription-constants';

export type AssetAddGate = {
  allowed: boolean;
  /** 当前主列表资产数 */
  currentCount: number;
};

/**
 * 是否还能新增一条主列表资产（新增或从回收站/归档恢复）
 */
export async function canAddAnotherAsset(): Promise<AssetAddGate> {
  const assets = await getAssets();
  const currentCount = assets.length;
  if (currentCount < FREE_ASSET_LIMIT) {
    return { allowed: true, currentCount };
  }
  const pro = await getIsProEntitlementActive();
  if (pro) {
    return { allowed: true, currentCount };
  }
  return { allowed: false, currentCount };
}
