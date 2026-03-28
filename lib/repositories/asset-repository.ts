/**
 * 资产持久化薄封装：便于未来替换存储/接入同步，调用方逐步从 asset-storage 迁移至此。
 */

import {
  addAsset as addAssetImpl,
  deleteAsset as deleteAssetImpl,
  getAssets as getAssetsImpl,
  saveAssets as saveAssetsImpl,
  updateAsset as updateAssetImpl,
} from '@/lib/asset-storage';
import type { SimpleAsset } from '@/types/asset';

export type AssetRepository = {
  getAll: () => Promise<SimpleAsset[]>;
  saveAll: (assets: SimpleAsset[]) => Promise<void>;
  update: (asset: SimpleAsset) => Promise<void>;
  add: (asset: SimpleAsset) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const assetRepository: AssetRepository = {
  getAll: getAssetsImpl,
  saveAll: saveAssetsImpl,
  update: updateAssetImpl,
  add: addAssetImpl,
  remove: deleteAssetImpl,
};
