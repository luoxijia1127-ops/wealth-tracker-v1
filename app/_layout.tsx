import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary as AppErrorBoundary } from '@/components/app-error-boundary';
import { FontRoot } from '@/components/font-root';
import { SettingsHubBackButton } from '@/components/settings-hub-back-navigation';
import { AppPaletteProvider, useAppPalette } from '@/contexts/app-palette-context';
import { LanguageProvider, useLanguage } from '@/contexts/language-context';
import { PurchasesProvider } from '@/contexts/purchases-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppFont } from '@/lib/app-fonts';
import { purgeLegacyTestSnapshotDatesOnce } from '@/lib/legacy-test-snapshot-purge';
import { migrateAssetupStorageFromLegacyOnce } from '@/lib/assetup-storage-migration';
import { useAppStore } from '@/lib/store/app-store';
import { startAutoRefresh, type AutoRefreshHandle } from '@/lib/store/auto-refresh';

// Anchor keeps (tabs) in the background when /modal is presented, so the tab context
// is preserved and the modal can be dismissed back to it.
export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Expo Router 自动识别 named export `ErrorBoundary`，
 * 在根 layout 内的任一层抛出未捕获错误时渲染。
 */
export { AppErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [hydrated, setHydrated] = useState<boolean>(
    () => useAppStore.getState().hydrated
  );

  useEffect(() => {
    let stopAutoRefresh: AutoRefreshHandle | null = null;
    let mounted = true;

    void (async () => {
      try {
        /** 旧 storage key 的一次性迁移必须先于 store hydrate */
        await migrateAssetupStorageFromLegacyOnce();
        await purgeLegacyTestSnapshotDatesOnce();
        await useAppStore.getState().hydrate();
      } finally {
        if (!mounted) return;
        setHydrated(true);
        /** hydrate 完成后开启自动刷新（冷启动 + 后台切回前台，3 分钟节流） */
        stopAutoRefresh = startAutoRefresh();
      }
    })();

    return () => {
      mounted = false;
      stopAutoRefresh?.();
    };
  }, []);

  return (
    <AppPaletteProvider>
      <LanguageProvider>
      <PurchasesProvider>
      <FontRoot>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {hydrated ? <AppStack /> : <HydrateGate />}
        <StatusBar style="auto" />
      </ThemeProvider>
      </FontRoot>
      </PurchasesProvider>
      </LanguageProvider>
    </AppPaletteProvider>
  );
}

/** hydrate 期间的全屏占位，避免空数据闪现到 Tab 屏幕 */
function HydrateGate() {
  const { theme } = useAppPalette();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.pageBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size="large" color={theme.primary} />
    </View>
  );
}

function AppStack() {
  const { t } = useLanguage();

  return (
        <Stack
          screenOptions={{
            headerShown: false,
            headerLeft: () => <SettingsHubBackButton />,
            headerTitleStyle: {
              fontFamily: AppFont.bold,
              fontSize: 17,
              fontWeight: '700',
            },
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="modal"
            options={{
              headerShown: false,
              presentation: 'modal',
              title: t('routes.addAsset'),
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="asset-action"
            options={{
              headerShown: false,
              presentation: 'modal',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="trade-edit"
            options={{
              headerShown: false,
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="cash-ledger-edit"
            options={{
              headerShown: false,
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-palette"
            options={{
              headerShown: false,
              title: t('routes.palette'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-attribution"
            options={{
              headerShown: false,
              title: t('routes.attribution'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-fx"
            options={{
              headerShown: false,
              title: t('routes.fx'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-export"
            options={{
              headerShown: false,
              title: t('routes.export'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-import"
            options={{
              headerShown: false,
              title: t('routes.import'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-help"
            options={{
              headerShown: false,
              title: t('routes.help'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-about"
            options={{
              headerShown: false,
              title: t('routes.about'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-privacy"
            options={{
              headerShown: false,
              title: t('routes.privacy'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-terms"
            options={{
              headerShown: false,
              title: t('routes.terms'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-display-currency"
            options={{
              headerShown: false,
              title: t('routes.displayCurrency'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-language"
            options={{
              headerShown: false,
              title: t('routes.language'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-cashflow-colors"
            options={{
              headerShown: false,
              title: t('routes.cashflowColors'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-archived"
            options={{
              headerShown: false,
              title: t('routes.archived'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-trash"
            options={{
              headerShown: false,
              title: t('routes.trash'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="market"
            options={{
              headerShown: false,
              title: t('market.title'),
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{
              headerShown: true,
              title: t('paywall.title'),
              headerShadowVisible: false,
            }}
          />
        </Stack>
  );
}
