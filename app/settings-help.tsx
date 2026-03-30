/**
 * 帮助与反馈
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsHelpScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);

  const bullets = [
    '在 Dashboard 右上角「+」添加资产；场内标的可同步行情并写入净值快照。',
    '「Insights」可查看净值走势、资产分布与投资回报。',
    '现金类支持增加/减少流水；证券类支持加减仓与成交记录。',
    '汇率与快照说明见「汇率信息」页。',
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '800', color: theme.primary, marginBottom: 14 }}>
        使用提示
      </Text>
      {bullets.map((line) => (
        <View key={line} style={{ flexDirection: 'row', marginBottom: 10, paddingRight: 8 }}>
          <Text style={{ color: secondary, marginRight: 8 }}>•</Text>
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: secondary }}>{line}</Text>
        </View>
      ))}
      <Text style={{ fontSize: 14, lineHeight: 21, color: muted, marginTop: 16 }}>
        反馈与建议：可在应用商店评论，或通过后续版本提供的反馈入口联系（占位）。
      </Text>
    </ScrollView>
  );
}
