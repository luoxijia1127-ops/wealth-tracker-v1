/**
 * Shared asset types used across Dashboard, Add Asset, Portfolio, etc.
 */

export type AssetCategory =
  | 'ShortTermInvestment'
  | 'LongTermInvestment'
  | 'Cash'
  | 'Other';

export type AssetType = 'Stock' | 'ETF' | 'Fund' | 'Deposit' | 'Gold';

export type SimpleAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  type: AssetType;
  shares: number;
  price: number;
  value: number;
};
