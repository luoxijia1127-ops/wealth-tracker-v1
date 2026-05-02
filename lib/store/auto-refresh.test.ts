import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
    },
  };
});

vi.mock('@/lib/net-worth-sync', () => ({
  syncNetWorthFromMarket: vi.fn(async () => ({})),
}));

type AppStateListener = (state: 'active' | 'background' | 'inactive') => void;

const listeners: AppStateListener[] = [];
const removeMock = vi.fn(() => {
  listeners.length = 0;
});

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn((event: string, cb: AppStateListener) => {
      if (event === 'change') listeners.push(cb);
      return { remove: removeMock };
    }),
  },
}));

const importAutoRefresh = async () => {
  const mod = await import('./auto-refresh');
  return mod;
};

const importStore = async () => {
  const mod = await import('./app-store');
  return mod;
};

const importNetSync = async () => {
  const mod = (await import('@/lib/net-worth-sync')) as unknown as {
    syncNetWorthFromMarket: ReturnType<typeof vi.fn>;
  };
  return mod;
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  listeners.length = 0;
});

afterEach(() => {
  listeners.length = 0;
});

describe('startAutoRefresh', () => {
  it('triggers an initial maybeAutoSync on cold start', async () => {
    const netSync = await importNetSync();
    const { startAutoRefresh } = await importAutoRefresh();
    const stop = startAutoRefresh();
    /** maybeAutoSync 是 async；让微任务跑完 */
    await Promise.resolve();
    await Promise.resolve();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);
    stop();
  });

  it('triggers maybeAutoSync on AppState=active', async () => {
    const netSync = await importNetSync();
    const { useAppStore, AUTO_REFRESH_THROTTLE_MS } = await importStore();
    const { startAutoRefresh } = await importAutoRefresh();

    const stop = startAutoRefresh();
    await Promise.resolve();
    await Promise.resolve();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);

    /** 节流刚生效，再触发 active 应跳过 */
    listeners.forEach((cb) => cb('active'));
    await Promise.resolve();
    await Promise.resolve();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);

    /** 把 lastSyncAt 拨到节流窗外，再 active 应触发 */
    useAppStore.setState({
      lastSyncAt: Date.now() - AUTO_REFRESH_THROTTLE_MS - 1,
    });
    listeners.forEach((cb) => cb('active'));
    await Promise.resolve();
    await Promise.resolve();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(2);

    stop();
  });

  it('does not trigger on background / inactive', async () => {
    const netSync = await importNetSync();
    const { useAppStore, AUTO_REFRESH_THROTTLE_MS } = await importStore();
    const { startAutoRefresh } = await importAutoRefresh();
    const stop = startAutoRefresh();
    await Promise.resolve();
    await Promise.resolve();
    netSync.syncNetWorthFromMarket.mockClear();
    /** 即使脱离节流，background / inactive 也不应触发 */
    useAppStore.setState({
      lastSyncAt: Date.now() - AUTO_REFRESH_THROTTLE_MS - 1,
    });
    listeners.forEach((cb) => cb('background'));
    listeners.forEach((cb) => cb('inactive'));
    await Promise.resolve();
    expect(netSync.syncNetWorthFromMarket).not.toHaveBeenCalled();
    stop();
  });

  it('returns a handle that removes the AppState subscription', async () => {
    const { startAutoRefresh } = await importAutoRefresh();
    const stop = startAutoRefresh();
    stop();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
