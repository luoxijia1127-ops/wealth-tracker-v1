/**
 * 设置页入口：支持紧凑工具块、大字号列表行等。
 */

import { AppFont } from '@/lib/app-fonts';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SettingsGridTileProps = {
  label: string;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  theme: AppPaletteTheme;
  onPress: () => void;
  variant?: 'tool' | 'secondary' | 'list';
  color?: string;
  textColor?: string;
};

export function SettingsGridTile({
  label,
  icon,
  theme,
  onPress,
  variant = 'tool',
  color,
  textColor,
}: SettingsGridTileProps) {
  const p = theme.primary;
  const isList = variant === 'list';
  const isTool = variant === 'tool';
  const isSecondary = variant === 'secondary';

  if (isList) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.listRow,
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name={icon} size={28} color={p} style={{ width: 40 }} />
        <Text style={[styles.listLabel, { color: p }]}>{label}</Text>
      </Pressable>
    );
  }

  // compact tool or secondary block
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.compactTile,
        isSecondary && styles.secondaryTile,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          isSecondary && styles.iconWrapSecondary,
          { borderColor: rgbaFromHex(textColor ?? p, 0.4) }
        ]}
      >
        <MaterialIcons name={icon} size={isSecondary ? 24 : 28} color={textColor ?? p} />
      </View>
      <Text
        numberOfLines={2}
        style={[
          styles.compactLabel,
          { color: textColor ?? p },
          isSecondary && styles.secondaryLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  compactTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    minWidth: '33%',
  },
  secondaryTile: {
    minWidth: '45%',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconWrapSecondary: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  compactLabel: {
    fontFamily: AppFont.medium,
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  secondaryLabel: {
    fontSize: 11,
    marginTop: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  listLabel: {
    fontFamily: AppFont.displayBold,
    fontSize: 32,
    letterSpacing: -0.6,
    marginLeft: 12,
  },
});
