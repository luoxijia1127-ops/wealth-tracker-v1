import {
  APP_PALETTE_THEMES,
  DEFAULT_PALETTE_ID,
  type AppPaletteId,
  type AppPaletteTheme,
} from '@/lib/app-palette';
import { loadPaletteId, savePaletteId } from '@/lib/palette-preference';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type AppPaletteContextValue = {
  theme: AppPaletteTheme;
  paletteId: AppPaletteId;
  setPaletteId: (id: AppPaletteId) => Promise<void>;
  ready: boolean;
};

const AppPaletteContext = createContext<AppPaletteContextValue | null>(null);

export function AppPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const theme = useMemo(
    () => APP_PALETTE_THEMES[paletteId] ?? APP_PALETTE_THEMES.sea,
    [paletteId]
  );

  const value = useMemo(
    () => ({
      theme,
      paletteId,
      setPaletteId,
      ready,
    }),
    [theme, paletteId, setPaletteId, ready]
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
