import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { FontRoot } from '@/components/font-root';
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
              headerBackTitle: '返回',
            }}
          />
          <Stack.Screen
            name="modal"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              presentation: 'modal',
              title: '添加资产',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="asset-action"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              presentation: 'modal',
              title: '资产',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="trade-edit"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="cash-ledger-edit"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-palette"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '应用配色',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-attribution"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '净值变动归因',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-fx"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '汇率信息',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-export"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '数据与导出',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-help"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '帮助与反馈',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-about"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '关于应用',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-privacy"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '隐私政策',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-terms"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '用户协议',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-display-currency"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '默认货币',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-language"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '语言设置',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-cashflow-colors"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '应用配色',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-archived"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '已归档',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-trash"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '最近删除',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="market"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
              title: '市场',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{
              headerShown: true,
              headerBackTitle: '返回',
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
