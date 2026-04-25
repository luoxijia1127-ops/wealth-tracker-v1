import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { FontRoot } from '@/components/font-root';
import { SettingsHubBackButton } from '@/components/settings-hub-back-navigation';
import { AppPaletteProvider } from '@/contexts/app-palette-context';
import { PurchasesProvider } from '@/contexts/purchases-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppFont } from '@/lib/app-fonts';
import { purgeLegacyTestSnapshotDatesOnce } from '@/lib/legacy-test-snapshot-purge';
import { migrateNestStorageFromWealthTrackerOnce } from '@/lib/nest-storage-migration';

// Anchor keeps (tabs) in the background when /modal is presented, so the tab context
// is preserved and the modal can be dismissed back to it.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void (async () => {
      await migrateNestStorageFromWealthTrackerOnce();
      await purgeLegacyTestSnapshotDatesOnce();
    })();
  }, []);

  return (
    <AppPaletteProvider>
      <PurchasesProvider>
      <FontRoot>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            headerBackTitleVisible: false,
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
              title: '添加资产',
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
              title: '应用配色',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-attribution"
            options={{
              headerShown: false,
              title: '净值变动归因',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-fx"
            options={{
              headerShown: false,
              title: '汇率信息',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-export"
            options={{
              headerShown: false,
              title: '数据与导出',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-import"
            options={{
              headerShown: false,
              title: '导入备份',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-help"
            options={{
              headerShown: false,
              title: '帮助与反馈',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-about"
            options={{
              headerShown: false,
              title: '关于应用',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-privacy"
            options={{
              headerShown: false,
              title: '隐私政策',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-terms"
            options={{
              headerShown: false,
              title: '用户协议',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-display-currency"
            options={{
              headerShown: false,
              title: '默认货币',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-language"
            options={{
              headerShown: false,
              title: '语言设置',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-cashflow-colors"
            options={{
              headerShown: false,
              title: '应用配色',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-archived"
            options={{
              headerShown: false,
              title: '已归档',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-trash"
            options={{
              headerShown: false,
              title: '最近删除',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="market"
            options={{
              headerShown: false,
              title: '市场',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{
              headerShown: true,
              title: '订阅',
              headerShadowVisible: false,
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
      </FontRoot>
      </PurchasesProvider>
    </AppPaletteProvider>
  );
}
