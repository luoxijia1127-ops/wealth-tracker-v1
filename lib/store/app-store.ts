/**
 * 全局轻量 store（zustand）。
 *
 * 设计目标：
 * - 单一数据源：assets / snapshots / assetDailySnapshots / displayCurrency / fxUsdRates。
 * - Repository 改造为「写后通过 subscribeXxx 通知 store」，旧调用方无需改动也会触发 store 更新。
 * - syncNetWorthFromMarket 走 persistMutex 串行化，并维护节流字段 lastSyncAt 给自动刷新使用。
 *
 * 注意：
 * - 不持有 React Context，可在任意非 React 模块（如 auto-refresh）通过 useAppStore.getState() 访问。
 * - 屏幕侧的迁移（去掉 useFocusEffect → reload）放在 PR2，本文件 PR1 阶段仅提供基础设施。
 */

import { create } from 'zustand';

import {
  getAssetDailySnapshots,
  subscribeAssetDailySnapshots,
  type AssetDailySnapshot,
} from '@/lib/asset-daily-snapshots';
import {
  getAssets,
  subscribeAssets,
} from '@/lib/asset-storage';
import {
  loadDisplayCurrency,
  subscribeDisplayCurrency,
} from '@/lib/display-currency-preference';
import {
  getCachedFxUsdRates,
  subscribeFxRates,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import {
  getNavChartBridges,
  subscribeNavChartBridges,
  type NavChartBridge,
} from '@/lib/nav-chart-bridge';
import { syncNetWorthFromMarket as runSyncNetWorth } from '@/lib/net-worth-sync';
import {
  getSnapshots,
  subscribeSnapshots,
  type Snapshot,
} from '@/lib/snapshots';
import type { SimpleAsset } from '@/types/asset';

import { persistMutex } from './mutex';

/** 自动刷新节流：距上次刷新 < 此值则跳过。下拉手势调用 syncNetWorthFromMarket 不受节流约束。 */
export const AUTO_REFRESH_THROTTLE_MS = 3 * 60 * 1000;

export type AppStoreState = {
  /** hydrate 是否已完成；屏幕渲染应在 hydrated 后避免显示空数据。 */
  hydrated: boolean;

  assets: SimpleAsset[];
  snapshots: Snapshot[];
  assetDailySnapshots: AssetDailySnapshot[];
  /** Insights 资产变动图：滞后录入的线性历史回补（不参与今日盈亏快照口径） */
  navChartBridges: NavChartBridge[];
  displayCurrency: string;
  fxUsdRates: FxUsdMidRates | null;

  /** 当前是否正在执行行情刷新（用于 UI 显示 / 节流去重）。 */
  syncing: boolean;
  /** 上次成功完成（或失败）的刷新时间戳（ms epoch）；自动刷新节流用。 */
  lastSyncAt: number | null;
  /** 上次刷新失败原因；成功时清空。 */
  lastSyncError: string | null;

  /** 并发读所有持久化键填充 store；幂等。 */
  hydrate: () => Promise<void>;
  /** 强制刷新（下拉手势调用，跳过节流）。 */
  syncNetWorthFromMarket: () => Promise<void>;
  /** 节流刷新（自动触发用）。 */
  maybeAutoSync: () => Promise<void>;
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  hydrated: false,
  assets: [],
  snapshots: [],
  assetDailySnapshots: [],
  navChartBridges: [],
  displayCurrency: 'CNY',
  fxUsdRates: null,
  syncing: false,
  lastSyncAt: null,
  lastSyncError: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const [assets, snapshots, daily, bridges, dc, fx] = await Promise.all([
      getAssets(),
      getSnapshots(),
      getAssetDailySnapshots(),
      getNavChartBridges(),
      loadDisplayCurrency(),
      getCachedFxUsdRates(),
    ]);
    set({
      assets,
      snapshots,
      assetDailySnapshots: daily,
      navChartBridges: bridges,
      displayCurrency: dc,
      fxUsdRates: fx,
      hydrated: true,
    });
  },

  syncNetWorthFromMarket: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    try {
      await persistMutex.run(() => runSyncNetWorth());
      set({ lastSyncAt: Date.now(), lastSyncError: null });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === 'string' ? e : 'sync failed';
      set({ lastSyncAt: Date.now(), lastSyncError: message });
    } finally {
      set({ syncing: false });
    }
  },

  maybeAutoSync: async () => {
    const { lastSyncAt, syncing } = get();
    if (syncing) return;
    if (lastSyncAt !== null && Date.now() - lastSyncAt < AUTO_REFRESH_THROTTLE_MS)
      return;
    await get().syncNetWorthFromMarket();
  },
}));

/**
 * 监听各 repository 的写入，把最新值同步到 store。
 * 这样即使屏幕仍在使用旧的 saveAssets / saveSnapshot 直接 API（PR2 之前），
 * store 内的 selectors 也能立刻看到新数据。
 */
let _subscribed = false;
function subscribeRepositoriesOnce(): void {
  if (_subscribed) return;
  _subscribed = true;
  subscribeAssets((assets) => useAppStore.setState({ assets }));
  subscribeSnapshots((snapshots) => useAppStore.setState({ snapshots }));
  subscribeAssetDailySnapshots((daily) =>
    useAppStore.setState({ assetDailySnapshots: daily })
  );
  subscribeNavChartBridges((navChartBridges) =>
    useAppStore.setState({ navChartBridges })
  );
  subscribeDisplayCurrency((dc) => useAppStore.setState({ displayCurrency: dc }));
  subscribeFxRates((fx) => useAppStore.setState({ fxUsdRates: fx }));
}
subscribeRepositoriesOnce();
