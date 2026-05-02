/**
 * 在 App 冷启动 hydrate 完成后、以及前后台切回前台 (AppState=active) 时，
 * 后台静默触发 maybeAutoSync()。
 *
 * 节流由 store 的 lastSyncAt + AUTO_REFRESH_THROTTLE_MS 控制（默认 3 分钟），
 * 短时间内反复 active 不会重复打 API。
 *
 * 失败仅写入 lastSyncError，不弹 Alert / 不阻塞 UI。
 */

import { AppState, type AppStateStatus } from 'react-native';

import { useAppStore } from './app-store';

export type AutoRefreshHandle = () => void;

export function startAutoRefresh(): AutoRefreshHandle {
  /** 冷启动 hydrate 完成后立即尝试一次（节流允许时） */
  void useAppStore.getState().maybeAutoSync();

  const handler = (state: AppStateStatus) => {
    if (state === 'active') {
      void useAppStore.getState().maybeAutoSync();
    }
  };

  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}
