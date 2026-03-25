/**
 * 场内单笔加减仓：校验并写入流水后回放，供资产页内联表单使用。
 */

import { getShanghaiDateString } from '@/lib/date-shanghai';
import { appendListedTrade } from '@/lib/trade-ledger';
import { getListedUnitPrice, type SimpleAsset } from '@/types/asset';

export type ListedAdjustInput = {
  side: 'buy' | 'sell';
  sharesStr: string;
  unitPriceStr: string;
  fundingSourceAssetId?: string;
  fundingSourceAssetName?: string;
  cashDestinationAssetId?: string;
  cashDestinationAssetName?: string;
  transferId?: string;
};

export type ListedAdjustResult =
  | { ok: true; asset: SimpleAsset }
  | { ok: false; message: string };

export function tryApplyListedAdjustTrade(
  editingAsset: SimpleAsset,
  input: ListedAdjustInput
): ListedAdjustResult {
  const isGold = editingAsset.category === 'Gold';
  const wantBuy = input.side === 'buy';
  const ts = parseFloat(input.sharesStr);
  const tp = parseFloat(input.unitPriceStr);

  if (Number.isNaN(ts) || ts <= 0) {
    return {
      ok: false,
      message: isGold ? '请填写本次成交克数。' : '请填写本次成交份额。',
    };
  }
  if (Number.isNaN(tp) || tp < 0) {
    return {
      ok: false,
      message: isGold
        ? '请填写本次成交单价（人民币/克）；卖出价为实际卖出价，与账面成本无关。'
        : '请填写本次成交单价（人民币/份）；卖出价为实际卖出价，与账面成本无关。',
    };
  }
  if (wantBuy && !(tp > 0)) {
    return { ok: false, message: '买入时成交单价须大于 0。' };
  }
  if (!wantBuy) {
    const oldS0 = editingAsset.shares ?? 0;
    if (ts > oldS0) {
      return {
        ok: false,
        message: isGold ? '卖出克数须小于等于当前持有克数。' : '卖出份额须小于等于当前持仓。',
      };
    }
  }

  const unit = getListedUnitPrice(editingAsset);
  let priceNum = 0;
  if (unit !== null && unit > 0) priceNum = unit;
  else if (
    typeof editingAsset.lastClose === 'number' &&
    editingAsset.lastClose > 0
  ) {
    priceNum = editingAsset.lastClose;
  } else if (
    isGold &&
    typeof editingAsset.avgCost === 'number' &&
    editingAsset.avgCost > 0
  ) {
    priceNum = editingAsset.avgCost;
  }
  if (!(priceNum > 0)) {
    return {
      ok: false,
      message: isGold
        ? '暂无 CNY/克 参考价：请在详情中填写参考市价，或配置金价接口后从 Dashboard 同步。'
        : '暂无有效市价参考，请先返回 Dashboard 同步行情后再试。',
    };
  }

  try {
    let assetToSave = appendListedTrade(
      editingAsset,
      wantBuy ? 'buy' : 'sell',
      ts,
      tp,
      getShanghaiDateString(),
      wantBuy
        ? {
            fundingSourceAssetId: input.fundingSourceAssetId,
            fundingSourceAssetName: input.fundingSourceAssetName,
            transferId: input.transferId,
          }
        : {
            cashDestinationAssetId: input.cashDestinationAssetId,
            cashDestinationAssetName: input.cashDestinationAssetName,
            transferId: input.transferId,
          }
    );
    assetToSave = {
      ...assetToSave,
      lastClose: editingAsset.lastClose,
      lastCloseDate: editingAsset.lastCloseDate,
    };
    if (
      typeof editingAsset.markPrice === 'number' &&
      editingAsset.markPrice > 0
    ) {
      assetToSave = {
        ...assetToSave,
        markPrice: editingAsset.markPrice,
        markPriceDate: editingAsset.markPriceDate,
      };
    }
    return { ok: true, asset: assetToSave };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : '流水与持仓不一致，请检查数值。',
    };
  }
}
