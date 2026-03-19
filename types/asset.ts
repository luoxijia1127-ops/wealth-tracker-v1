/**
 * Shared asset types used across Dashboard, Add Asset, Portfolio, etc.
 *
 * Asset structure: { id, name, value, category, type, history? }
 * - id: unique (timestamp or uuid)
 * - value: total dollar amount
 * - category, type: classification strings
 * - history: optional array of { date, value } for value changes over time
 */

/** A single history record for an asset value at a given date (YYYY-MM-DD). */
export type AssetHistoryEntry = {
  date: string;
  value: number;
};

export type AssetCategory =
  | 'ShortTermInvestment'
  | 'LongTermInvestment'
  | 'Cash'
  | 'Other';

export type AssetType = 'Stock' | 'ETF' | 'Fund' | 'Deposit' | 'Gold';

export type SimpleAsset = {
  id: string;
  name: string;
  value: number;
  category: string;
  type: string;
  /** Value history: [{ date, value }]. Appended on updates, never overwritten. */
  history?: AssetHistoryEntry[];
};

/** Generates a unique id (timestamp + random string). */
export function generateAssetId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Ensures an asset has an id. Migrates legacy format (shares, price) to value-only.
 * Call when loading from storage to support old data.
 */
export function ensureAsset(raw: unknown): SimpleAsset {
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === 'string' && o.id.length > 0
      ? o.id
      : generateAssetId();
  const name = typeof o.name === 'string' ? o.name : '';
  const category = typeof o.category === 'string' ? o.category : 'Other';
  const type = typeof o.type === 'string' ? o.type : 'Other';

  // Value: prefer stored value; for legacy (shares+price), compute
  let value = typeof o.value === 'number' && !Number.isNaN(o.value) ? o.value : 0;
  if (value === 0 && typeof o.shares === 'number' && typeof o.price === 'number') {
    if (o.shares > 0 && o.price > 0) {
      value = o.shares * o.price;
    }
  }

  // History: preserve if valid array of { date, value }
  let history: AssetHistoryEntry[] | undefined;
  if (Array.isArray(o.history)) {
    history = o.history
      .filter(
        (h: unknown): h is AssetHistoryEntry =>
          typeof h === 'object' &&
          h !== null &&
          typeof (h as AssetHistoryEntry).date === 'string' &&
          typeof (h as AssetHistoryEntry).value === 'number'
      )
      .slice(); // copy, don't mutate source
    if (history.length === 0) history = undefined;
  }

  return { id, name, value, category, type, ...(history && { history }) };
}
