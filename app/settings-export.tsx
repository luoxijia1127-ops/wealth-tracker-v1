/**
 * 数据导出：占位说明，后续可接 JSON 导出等。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsExportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const secondary = rgbaFromHex(theme.primary, 0.65);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.primary, marginBottom: 12 }}>
        数据与存储
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary }}>
        资产、流水与快照均保存在本机（AsyncStorage），不会上传至服务器。更换设备时如需迁移，请使用后续版本提供的导出/导入功能。
      </Text>
    </ScrollView>
  );
}
