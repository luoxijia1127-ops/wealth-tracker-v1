import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AppPaletteProvider } from '@/contexts/app-palette-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { purgeLegacyTestSnapshotDatesOnce } from '@/lib/legacy-test-snapshot-purge';

// Anchor keeps (tabs) in the background when /modal is presented, so the tab context
// is preserved and the modal can be dismissed back to it.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void purgeLegacyTestSnapshotDatesOnce();
  }, []);

  return (
    <AppPaletteProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              title: 'Add Asset',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="asset-action"
            options={{
              presentation: 'modal',
              title: '资产',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="trade-edit"
            options={{
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="cash-ledger-edit"
            options={{
              presentation: 'modal',
              gestureEnabled: true,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-palette"
            options={{
              title: '应用配色',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-attribution"
            options={{
              title: '净值变动归因',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings-fx"
            options={{ title: '汇率信息', headerShadowVisible: false }}
          />
          <Stack.Screen
            name="settings-export"
            options={{ title: '数据与导出', headerShadowVisible: false }}
          />
          <Stack.Screen
            name="settings-help"
            options={{ title: '帮助与反馈', headerShadowVisible: false }}
          />
          <Stack.Screen
            name="settings-about"
            options={{ title: '关于应用', headerShadowVisible: false }}
          />
          <Stack.Screen
            name="settings-privacy"
            options={{ title: '隐私说明', headerShadowVisible: false }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AppPaletteProvider>
  );
}
