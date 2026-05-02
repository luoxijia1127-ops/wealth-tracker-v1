/**
 * 便利 selector hooks。屏幕迁移到 store 时优先使用这里的 hooks，
 * 而不是 useAppStore((s) => s.xxx) 散落在各处。
 *
 * PR1 仅暴露最小集合；派生 selector（如 useDashboardAssets）随 PR2 屏幕迁移再补。
 */

import { useAppStore } from './app-store';

export const useHydrated = () => useAppStore((s) => s.hydrated);
export const useAssets = () => useAppStore((s) => s.assets);
export const useSnapshots = () => useAppStore((s) => s.snapshots);
export const useAssetDailySnapshots = () =>
  useAppStore((s) => s.assetDailySnapshots);
export const useDisplayCurrency = () => useAppStore((s) => s.displayCurrency);
export const useFxUsdRates = () => useAppStore((s) => s.fxUsdRates);
export const useSyncing = () => useAppStore((s) => s.syncing);
export const useLastSyncAt = () => useAppStore((s) => s.lastSyncAt);
export const useLastSyncError = () => useAppStore((s) => s.lastSyncError);
