/**
 * 导出「手动」交易明细：现金余额流水 + 场内加减仓流水（不含市价快照类记录）。
 */

import { getAssetCurrency } from '@/lib/asset-value';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import type { SupportedLocale } from '@/lib/language';
import {
  CATEGORY_LABEL_ZH,
  type AssetCategory,
  type CashLedgerEntry,
  type SimpleAsset,
  type TradeLedgerEntry,
} from '@/types/asset';

export type ManualTransactionExportRow = {
  date: string;
  detailType: '余额增减' | '场内买卖';
  assetName: string;
  categoryLabel: string;
  direction: string;
  /** 现金：正为增加、负为减少；场内：成交金额（买/卖均为正数表示成交额规模） */
  amount: number;
  currency: string;
  shares: string;
  unitPrice: string;
  related: string;
  note: string;
  internalTransfer: boolean;
};

function isTradeInternal(t: TradeLedgerEntry): boolean {
  return !!(
    (typeof t.transferId === 'string' && t.transferId.trim().length > 0) ||
    t.fundingSourceAssetId ||
    (typeof t.fundingSourceAssetName === 'string' &&
      t.fundingSourceAssetName.trim().length > 0) ||
    t.cashDestinationAssetId ||
    (typeof t.cashDestinationAssetName === 'string' &&
      t.cashDestinationAssetName.trim().length > 0)
  );
}

function isCashInternal(e: CashLedgerEntry): boolean {
  return typeof e.transferId === 'string' && e.transferId.length > 0;
}

function safeNum(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/** 日期在 [start, end] 内（含），均为 YYYY-MM-DD */
export function isDateInRange(date: string, start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
  return date >= start && date <= end;
}

/**
 * 从资产列表收集手动流水，按日期、资产名排序。
 */
export function collectManualTransactions(
  assets: SimpleAsset[],
  range: { start: string; end: string }
): ManualTransactionExportRow[] {
  const { start, end } = range;
  const rows: ManualTransactionExportRow[] = [];

  for (const a of assets) {
    const name = a.name || '(未命名)';
    const cur = getAssetCurrency(a);
    const cat = CATEGORY_LABEL_ZH[a.category as AssetCategory] ?? a.category;

    for (const e of a.cashLedger ?? []) {
      const d = e.entryDate;
      if (typeof d !== 'string' || !isDateInRange(d, start, end)) continue;
      const amt = safeNum(e.amount);
      if (!(amt > 0)) continue;
      const signed = e.side === 'in' ? amt : -amt;
      const relParts: string[] = [];
      if (e.relatedAssetName) relParts.push(`关联：${e.relatedAssetName}`);
      if (e.relatedAssetId) relParts.push(`id:${e.relatedAssetId}`);
      rows.push({
        date: d,
        detailType: '余额增减',
        assetName: name,
        categoryLabel: cat,
        direction: e.side === 'in' ? '增加' : '减少',
        amount: signed,
        currency: cur,
        shares: '',
        unitPrice: '',
        related: relParts.join(' '),
        note: e.note ?? '',
        internalTransfer: isCashInternal(e),
      });
    }

    for (const t of a.tradeHistory ?? []) {
      const d = t.tradeDate;
      if (typeof d !== 'string' || !isDateInRange(d, start, end)) continue;
      const qty = safeNum(t.shares);
      const px = safeNum(t.unitPriceCny);
      if (!(qty > 0) || !(px >= 0)) continue;
      const turnover = qty * px;
      const relParts: string[] = [];
      if (t.fundingSourceAssetName)
        relParts.push(`资金来源：${t.fundingSourceAssetName}`);
      if (t.cashDestinationAssetName)
        relParts.push(`资金去向：${t.cashDestinationAssetName}`);
      if (t.transferId) relParts.push(`transfer:${t.transferId}`);
      rows.push({
        date: d,
        detailType: '场内买卖',
        assetName: name,
        categoryLabel: cat,
        direction: t.side === 'buy' ? '买入' : '卖出',
        amount: turnover,
        currency: cur,
        shares: String(qty),
        unitPrice: String(px),
        related: relParts.join('；'),
        note: '',
        internalTransfer: isTradeInternal(t),
      });
    }
  }

  rows.sort((x, y) => {
    const c = x.date.localeCompare(y.date);
    if (c !== 0) return c;
    const t = x.detailType.localeCompare(y.detailType);
    if (t !== 0) return t;
    return x.assetName.localeCompare(y.assetName);
  });
  return rows;
}

/** 全库流水最早、最晚日期（无流水时返回今天、今天） */
export function getManualTransactionDateBounds(
  assets: SimpleAsset[]
): { min: string; max: string } {
  let min = '9999-12-31';
  let max = '0000-01-01';
  const bump = (d: string) => {
    if (d < min) min = d;
    if (d > max) max = d;
  };
  for (const a of assets) {
    for (const e of a.cashLedger ?? []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(e.entryDate)) bump(e.entryDate);
    }
    for (const t of a.tradeHistory ?? []) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(t.tradeDate)) bump(t.tradeDate);
    }
  }
  const today = getShanghaiDateString();
  if (min === '9999-12-31') return { min: today, max: today };
  const endCap = max > today ? max : today;
  return { min, max: endCap };
}

function csvEscape(s: string): string {
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV，首列为 UTF-8 BOM，便于 Excel 打开中文 */
export function manualTransactionsToCsv(
  rows: ManualTransactionExportRow[],
  locale: SupportedLocale = 'zh-CN'
): string {
  const header =
    locale === 'en-US'
      ? [
          'Date',
          'Detail Type',
          'Asset Name',
          'Category',
          'Direction',
          'Amount',
          'Currency',
          'Shares',
          'Unit Price',
          'Related',
          'Note',
          'Internal Transfer',
        ]
      : [
          '日期',
          '明细类型',
          '资产名称',
          '资产类别',
          '方向',
          '金额',
          '币种',
          '份额',
          '单价',
          '关联信息',
          '备注',
          '内部划转',
        ];
  const lines = [
    header.map(csvEscape).join(','),
    ...rows.map((r) =>
      [
        r.date,
        r.detailType,
        r.assetName,
        r.categoryLabel,
        r.direction,
        String(r.amount),
        r.currency,
        r.shares,
        r.unitPrice,
        r.related,
        r.note,
        r.internalTransfer
          ? locale === 'en-US'
            ? 'Yes'
            : '是'
          : locale === 'en-US'
            ? 'No'
            : '否',
      ]
        .map((x) => csvEscape(String(x)))
        .join(',')
    ),
  ];
  return `\ufeff${lines.join('\r\n')}`;
}

export type DatePresetId = 'd7' | 'd30' | 'm3' | 'year' | 'all';

function shanghaiDaysAgo(days: number): string {
  const d = new Date();
  d.setTime(d.getTime() - days * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

/** 快捷期间（「全部」为库内流水最早日至今日或最晚日） */
export function getPresetDateRange(
  preset: DatePresetId,
  assets: SimpleAsset[]
): { start: string; end: string } {
  const today = getShanghaiDateString();
  const bounds = getManualTransactionDateBounds(assets);

  switch (preset) {
    case 'd7':
      return { start: shanghaiDaysAgo(6), end: today };
    case 'd30':
      return { start: shanghaiDaysAgo(29), end: today };
    /** 近 3 个月：按自然日滚动约 90 天（与近 7/30 天同一套口径） */
    case 'm3':
      return { start: shanghaiDaysAgo(89), end: today };
    case 'year': {
      const y = today.slice(0, 4);
      return { start: `${y}-01-01`, end: today };
    }
    case 'all':
      return { start: bounds.min, end: bounds.max };
    default:
      return { start: shanghaiDaysAgo(29), end: today };
  }
}
