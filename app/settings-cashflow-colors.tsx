/**
 * 收支颜色：涨跌与正负展示色（与主题色协调）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function SettingsCashflowColorsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.6);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 15, lineHeight: 22, color: muted, marginBottom: 16 }}>
        收支与涨跌颜色会随「应用配色」主题略有变化。若需完全自定义绿/红与强调色，可在应用配色中选择不同 ins 风主题。
      </Text>
      <Pressable
        onPress={() => router.push('/settings-palette')}
        style={{
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: p }}>前往应用配色</Text>
      </Pressable>
    </ScrollView>
  );
}
