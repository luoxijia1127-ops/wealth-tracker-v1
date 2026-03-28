/**
 * 设置：网格入口（配色、净值归因等），详情在独立 Stack 页。
 */

import { SettingsGridTile } from '@/components/settings-grid-tile';
import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SettingsEntry = {
  id: string;
  label: string;
  href: '/settings-palette' | '/settings-attribution';
  icon: ComponentProps<typeof MaterialIcons>['name'];
};

const SETTINGS_ENTRIES: SettingsEntry[] = [
  {
    id: 'palette',
    label: '应用配色',
    href: '/settings-palette',
    icon: 'palette',
  },
  {
    id: 'attribution',
    label: '净值变动归因',
    href: '/settings-attribution',
    icon: 'stacked-line-chart',
  },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { theme } = useAppPalette();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: theme.primary,
          marginBottom: 8,
        }}
      >
        设置
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: rgbaFromHex(theme.primary, 0.65),
          marginBottom: 20,
          lineHeight: 20,
        }}
      >
        点选下方入口进入对应功能；后续可在此继续增加方块。
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -6,
        }}
      >
        {SETTINGS_ENTRIES.map((item) => (
          <SettingsGridTile
            key={item.id}
            label={item.label}
            icon={item.icon}
            theme={theme}
            onPress={() => router.push(item.href)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
