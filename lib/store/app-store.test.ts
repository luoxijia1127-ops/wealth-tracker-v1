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
      clear: vi.fn(async () => {
        store.clear();
      }),
      multiGet: vi.fn(async (keys: string[]) =>
        keys.map((k) => [k, store.get(k) ?? null] as const)
      ),
    },
  };
});

vi.mock('@/lib/net-worth-sync', () => ({
  syncNetWorthFromMarket: vi.fn(async () => ({})),
}));

const importStore = async () => {
  const mod = await import('./app-store');
  return mod;
};

const importMutex = async () => {
  const mod = await import('./mutex');
  return mod;
};

const importNetSync = async () => {
  const mod = (await import('@/lib/net-worth-sync')) as unknown as {
    syncNetWorthFromMarket: ReturnType<typeof vi.fn>;
  };
  return mod;
};

const importAssetStorage = async () => {
  const mod = await import('@/lib/asset-storage');
  return mod;
};

const importDisplayCurrency = async () => {
  const mod = await import('@/lib/display-currency-preference');
  return mod;
};

beforeEach(async () => {
  vi.resetModules();
  vi.useRealTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Mutex', () => {
  it('runs tasks sequentially in FIFO order', async () => {
    const { Mutex } = await importMutex();
    const m = new Mutex();
    const calls: number[] = [];

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const a = m.run(async () => {
      await wait(20);
      calls.push(1);
      return 1;
    });
    const b = m.run(async () => {
      calls.push(2);
      return 2;
    });
    const c = m.run(async () => {
      calls.push(3);
      return 3;
    });

    await expect(Promise.all([a, b, c])).resolves.toEqual([1, 2, 3]);
    expect(calls).toEqual([1, 2, 3]);
  });

  it('continues with next task after a rejection', async () => {
    const { Mutex } = await importMutex();
    const m = new Mutex();

    const a = m.run(async () => {
      throw new Error('boom');
    });
    const b = m.run(async () => 'ok');

    await expect(a).rejects.toThrow('boom');
    await expect(b).resolves.toBe('ok');
  });
});

describe('useAppStore.hydrate', () => {
  it('starts hydrated=false and flips after hydrate()', async () => {
    const { useAppStore } = await importStore();
    expect(useAppStore.getState().hydrated).toBe(false);
    await useAppStore.getState().hydrate();
    expect(useAppStore.getState().hydrated).toBe(true);
    expect(useAppStore.getState().displayCurrency).toBe('CNY');
    expect(useAppStore.getState().assets).toEqual([]);
  });

  it('is idempotent: second call is a no-op', async () => {
    const { useAppStore } = await importStore();
    const assetStorage = await importAssetStorage();
    const spy = vi.spyOn(assetStorage, 'getAssets');
    await useAppStore.getState().hydrate();
    await useAppStore.getState().hydrate();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('repository → store auto sync', () => {
  it('saveDisplayCurrency updates store.displayCurrency', async () => {
    const { useAppStore } = await importStore();
    await useAppStore.getState().hydrate();
    const dc = await importDisplayCurrency();
    await dc.saveDisplayCurrency('USD');
    expect(useAppStore.getState().displayCurrency).toBe('USD');
  });

  it('saveAssets updates store.assets', async () => {
    const { useAppStore } = await importStore();
    await useAppStore.getState().hydrate();
    const assetStorage = await importAssetStorage();
    const next = [
      {
        id: 'a',
        category: 'Cash',
        name: 'wallet',
        value: 100,
        currency: 'CNY',
        updatedAt: 0,
      },
    ];
    await assetStorage.saveAssets(next as never);
    expect(useAppStore.getState().assets).toHaveLength(1);
    expect(useAppStore.getState().assets[0]?.id).toBe('a');
  });
});

describe('syncNetWorthFromMarket', () => {
  it('writes lastSyncAt and clears lastSyncError on success', async () => {
    const { useAppStore } = await importStore();
    const before = Date.now();
    await useAppStore.getState().syncNetWorthFromMarket();
    const s = useAppStore.getState();
    expect(s.syncing).toBe(false);
    expect(s.lastSyncAt).not.toBeNull();
    expect(s.lastSyncAt!).toBeGreaterThanOrEqual(before);
    expect(s.lastSyncError).toBeNull();
  });

  it('writes lastSyncError on failure but still updates lastSyncAt', async () => {
    const netSync = await importNetSync();
    netSync.syncNetWorthFromMarket.mockRejectedValueOnce(new Error('net down'));
    const { useAppStore } = await importStore();
    await useAppStore.getState().syncNetWorthFromMarket();
    const s = useAppStore.getState();
    expect(s.syncing).toBe(false);
    expect(s.lastSyncError).toBe('net down');
    expect(s.lastSyncAt).not.toBeNull();
  });

  it('is reentrancy-safe: concurrent invocations only run once', async () => {
    const netSync = await importNetSync();
    let resolveSync: (v: unknown) => void = () => {};
    /** 仅本测试内 hang 一次；后续测试仍用默认 async () => ({}) */
    netSync.syncNetWorthFromMarket.mockImplementationOnce(
      () => new Promise((res) => (resolveSync = res))
    );
    const { useAppStore } = await importStore();
    const p1 = useAppStore.getState().syncNetWorthFromMarket();
    /** 让 p1 进入 await 状态 */
    await Promise.resolve();
    await Promise.resolve();
    expect(useAppStore.getState().syncing).toBe(true);

    const p2 = useAppStore.getState().syncNetWorthFromMarket();
    await p2;
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);

    resolveSync(undefined);
    await p1;
    expect(useAppStore.getState().syncing).toBe(false);
  });
});

describe('maybeAutoSync throttle', () => {
  it('skips when within throttle window', async () => {
    const netSync = await importNetSync();
    const { useAppStore, AUTO_REFRESH_THROTTLE_MS } = await importStore();

    await useAppStore.getState().maybeAutoSync();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);

    /** lastSyncAt 已更新；立即再调应跳过 */
    await useAppStore.getState().maybeAutoSync();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(1);

    /** 手动把 lastSyncAt 拨到节流窗外 */
    useAppStore.setState({
      lastSyncAt: Date.now() - AUTO_REFRESH_THROTTLE_MS - 1,
    });
    await useAppStore.getState().maybeAutoSync();
    expect(netSync.syncNetWorthFromMarket).toHaveBeenCalledTimes(2);
  });

  it('skips when syncing=true even if outside throttle window', async () => {
    const netSync = await importNetSync();
    const { useAppStore } = await importStore();
    useAppStore.setState({ syncing: true, lastSyncAt: 0 });
    await useAppStore.getState().maybeAutoSync();
    expect(netSync.syncNetWorthFromMarket).not.toHaveBeenCalled();
  });
});
