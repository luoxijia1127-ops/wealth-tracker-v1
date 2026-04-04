/**
 * 场内单笔加减仓：校验并写入流水后回放，供资产页内联表单使用。
 */

import { getAssetCurrency } from '@/lib/asset-value';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { appendListedTrade } from '@/lib/trade-ledger';
import { getListedUnitPrice, type SimpleAsset } from '@/types/asset';

export type ListedAdjustInput = {
  /** 带符号份额/克数：正=买入，负=卖出；无符号视为买入 */
  sharesStr: string;
  unitPriceStr: string;
  fundingSourceAssetId?: string;
  fundingSourceAssetName?: string;
  cashDestinationAssetId?: string;
  cashDestinationAssetName?: string;
  transferId?: string;
};

function parseSignedListedShares(s: string): number | null {
  const t = s.trim().replace(/,/g, '');
  if (t === '' || t === '+' || t === '-') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export type ListedAdjustResult =
  | { ok: true; asset: SimpleAsset }
  | { ok: false; message: string };

export function tryApplyListedAdjustTrade(
  editingAsset: SimpleAsset,
  input: ListedAdjustInput
): ListedAdjustResult {
  const isGold = editingAsset.category === 'Gold';
  const signed = parseSignedListedShares(input.sharesStr);
  if (signed === null || signed === 0) {
    return {
      ok: false,
      message: isGold
        ? '请填写本次克数变动（正为买入，负为卖出）。'
        : '请填写本次份额变动（正为买入，负为卖出）。',
    };
  }
  const wantBuy = signed > 0;
  const ts = Math.abs(signed);
  const tp = parseFloat(input.unitPriceStr);

  if (Number.isNaN(tp) || tp < 0) {
    const ccy = getAssetCurrency(editingAsset);
    return {
      ok: false,
      message: isGold
        ? '请填写本次成交单价（人民币/克）；卖出价为实际卖出价，与账面成本无关。'
        : `请填写本次成交单价（${ccy}/份）；卖出价为实际卖出价，与账面成本无关。`,
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
  } else if (
    !isGold &&
    typeof editingAsset.avgCost === 'number' &&
    editingAsset.avgCost > 0
  ) {
    priceNum = editingAsset.avgCost;
  }
  if (!(priceNum > 0)) {
    return {
      ok: false,
      message: isGold
        ? '暂无 CNY/克 参考价：请在详情中填写参考市价，或同步 Dashboard 行情（贵金属按品种拉取参考价）。'
        : '暂无行情收盘价：请先在 Dashboard 同步，或确保持仓已有成本均价。',
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
