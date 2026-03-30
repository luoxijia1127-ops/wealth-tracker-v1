/**
 * 隐私说明
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsPrivacyScreen() {
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
        隐私与数据
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary }}>
        默认情况下，您的资产与流水数据仅存储于当前设备。同步行情与汇率时会向公开接口请求市场数据，不会上传您的账本内容。请妥善保管设备与系统备份。
      </Text>
    </ScrollView>
  );
}
