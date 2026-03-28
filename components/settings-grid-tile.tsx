/**
 * 设置页网格入口：圆形图标底 + 短标签，便于后续扩展更多方块。
 */

import { rgbaFromHex } from '@/lib/color-utils';
import type { AppPaletteTheme } from '@/lib/app-palette';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SettingsGridTileProps = {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  theme: AppPaletteTheme;
  onPress: () => void;
};

export function SettingsGridTile({
  label,
  icon,
  theme,
  onPress,
}: SettingsGridTileProps) {
  const border = rgbaFromHex(theme.primary, 0.1);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '33.333%',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 6,
        opacity: pressed ? 0.88 : 1,
      })}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        <MaterialIcons name={icon} size={26} color={theme.primary} />
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: 10,
          fontSize: 12,
          fontWeight: '600',
          color: rgbaFromHex(theme.primary, 0.82),
          textAlign: 'center',
          lineHeight: 16,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
