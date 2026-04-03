/**
 * 语言设置
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { Pressable, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsLanguageScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const p = theme.primary;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: p, marginBottom: 12 }}>
        当前界面语言
      </Text>
      <Pressable
        style={{
          borderRadius: 16,
          padding: 16,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: p,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: p }}>简体中文</Text>
        <Text style={{ fontSize: 13, color: rgbaFromHex(p, 0.55), marginTop: 6 }}>
          已启用
        </Text>
      </Pressable>
      <Text style={{ fontSize: 14, color: rgbaFromHex(p, 0.55), marginTop: 20, lineHeight: 20 }}>
        English 等多语言将在后续版本提供。
      </Text>
    </ScrollView>
  );
}
