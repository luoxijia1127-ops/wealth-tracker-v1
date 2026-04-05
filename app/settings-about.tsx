/**
 * 关于应用
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import Constants from 'expo-constants';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsAboutScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const secondary = rgbaFromHex(theme.primary, 0.65);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '800', color: theme.primary, marginBottom: 8 }}>
        Nest
      </Text>
      <Text style={{ fontSize: 14, color: secondary, marginBottom: 20 }}>个人资产与净值记录</Text>
      <View
        style={{
          borderRadius: 20,
          padding: 16,
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.95)',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.primary }}>版本 {version}</Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: secondary, marginTop: 12 }}>
          基于 Expo / React Native 构建。本应用仅供个人记账与复盘，不构成投资建议。
        </Text>
      </View>
    </ScrollView>
  );
}
