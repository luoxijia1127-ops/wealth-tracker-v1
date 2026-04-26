/**
 * 帮助与反馈
 */

import { SettingsEditorialMasthead } from '@/components/settings-editorial-masthead';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { useCallback, useMemo } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEEDBACK_EMAIL = 'assetup_feedback@163.com';

export default function SettingsHelpScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);
  const linkColor = rgbaFromHex(theme.primary, 0.95);

  const openEmail = useCallback(() => {
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}`);
  }, []);

  const bullets = [
    '在总览页右上角「+」添加资产；场内标的可同步行情并写入净值快照。',
    '「洞察」页可查看净值走势、资产分布与投资回报。',
    '类现金支持增加/减少流水；证券类支持加减仓与成交记录。',
    '汇率与快照说明见「汇率信息」页。',
  ];

  return (
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsEditorialMasthead
          styles={hubStyles}
          title="HELP"
          kicker="TIPS & FEEDBACK"
        />
        <View style={{ paddingHorizontal: 20 }}>
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
        反馈与建议：可在应用商店留言，或发邮件至{' '}
        <Text
          accessibilityRole="link"
          onPress={openEmail}
          style={{
            fontSize: 14,
            lineHeight: 21,
            color: linkColor,
            textDecorationLine: 'underline',
            fontWeight: '600',
          }}
        >
          {FEEDBACK_EMAIL}
        </Text>
        。
      </Text>
        </View>
      </ScrollView>
    </View>
  );
}
