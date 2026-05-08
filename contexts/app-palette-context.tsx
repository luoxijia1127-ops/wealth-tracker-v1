import { usePurchasesEntitlement } from '@/contexts/purchases-context';
import {
  DEFAULT_PALETTE_ID,
  FREE_TIER_PALETTE_ID,
  type AppPaletteId,
  type AppPaletteTheme,
} from '@/lib/app-palette';
import {
  appearanceFromColorScheme,
  resolvePaletteTheme,
} from '@/lib/palette-resolve';
import { loadPaletteId, savePaletteId } from '@/lib/palette-preference';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

type AppPaletteContextValue = {
  theme: AppPaletteTheme;
  paletteId: AppPaletteId;
  /** 当前解析后的浅色 / 深色（跟随系统） */
  appearance: 'light' | 'dark';
  setPaletteId: (id: AppPaletteId) => Promise<void>;
  ready: boolean;
};

const AppPaletteContext = createContext<AppPaletteContextValue | null>(null);

export function AppPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready: purchasesReady, isPro } = usePurchasesEntitlement();
  const systemScheme = useColorScheme();
  const appearance = useMemo(
    () => appearanceFromColorScheme(systemScheme),
    [systemScheme]
  );

  const [paletteId, setPaletteIdState] =
    useState<AppPaletteId>(DEFAULT_PALETTE_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPaletteId().then((id) => {
      if (!cancelled) {
        setPaletteIdState(id);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPaletteId = useCallback(async (id: AppPaletteId) => {
    setPaletteIdState(id);
    await savePaletteId(id);
  }, []);

  /** 非会员持久化偏好若为会员专属主题，在订阅状态就绪后强制回落到免费档配色 */
  useEffect(() => {
    if (!ready || !purchasesReady) return;
    if (isPro) return;
    if (paletteId === FREE_TIER_PALETTE_ID) return;
    void setPaletteId(FREE_TIER_PALETTE_ID);
  }, [ready, purchasesReady, isPro, paletteId, setPaletteId]);

  const theme = useMemo(
    () => resolvePaletteTheme(paletteId, appearance),
    [paletteId, appearance]
  );

  const value = useMemo(
    () => ({
      theme,
      paletteId,
      appearance,
      setPaletteId,
      ready,
    }),
    [theme, paletteId, appearance, setPaletteId, ready]
  );

  return (
    <AppPaletteContext.Provider value={value}>
      {children}
    </AppPaletteContext.Provider>
  );
}

export function useAppPalette(): AppPaletteContextValue {
  const ctx = useContext(AppPaletteContext);
  if (!ctx) {
    throw new Error('useAppPalette must be used within AppPaletteProvider');
  }
  return ctx;
}
