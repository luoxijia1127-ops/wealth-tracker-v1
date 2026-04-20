/**
 * 应用配色：从设置网格进入，选择 ins 风主题。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import {
  APP_PALETTE_THEMES,
  PALETTE_IDS,
  PALETTE_OPTION_NEW_IDS,
  type AppPaletteId,
} from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SWATCH_W = 100;
const SWATCH_H = 31;
const SWATCH_OVERLAP = 45;
const ROW_PAD_V = 9;
const ROW_MIN_H = 32;

const LIST_ROW = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  paddingVertical: 14,
  paddingHorizontal: 24,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: 'rgba(0,0,0,0.06)',
};

function PaletteSwatchStack({
  colors,
}: {
  colors: readonly [string, string, string, string];
}) {
  const r = SWATCH_W / 2;
  const stackW = SWATCH_W + SWATCH_OVERLAP * (colors.length - 1);
  return (
    <View
      style={{
        width: stackW,
        height: SWATCH_H,
        marginRight: 4,
      }}
    >
      {colors.map((c, i) => (
        <View
          key={`${c}-${i}`}
          style={{
            position: 'absolute',
            left: i * SWATCH_OVERLAP,
            width: SWATCH_W,
            height: SWATCH_H,
            borderRadius: r,
            backgroundColor: c,
            zIndex: i + 1,
          }}
        />
      ))}
    </View>
  );
}

export default function SettingsPaletteScreen() {
  const insets = useSafeAreaInsets();
  const { theme, paletteId, setPaletteId } = useAppPalette();
  const styles = useMemo(() => createSettingsScreenStyles(theme), [theme]);
  const p = theme.primary;

  const newSet = new Set<string>(PALETTE_OPTION_NEW_IDS);

  return (
    <View style={styles.screen}>
      <View style={styles.screenAmbient} pointerEvents="none" />

      <SettingsHubBackTopBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 28,
            backgroundColor: 'transparent',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.mastheadBlock, { paddingTop: 16 }]}>
          <Text style={styles.masthead}>PALETTE</Text>
          <Text style={styles.kicker}>THEMES & ACCENTS</Text>
        </View>

        <View style={styles.preferencesBlock}>
          <View style={{ gap: 0 }}>
            {PALETTE_IDS.map((id: AppPaletteId) => {
              const t = APP_PALETTE_THEMES[id];
              const selected = paletteId === id;
              const showNew = newSet.has(id);
              const four = [
                t.swatches[0]!,
                t.swatches[1]!,
                t.swatches[2]!,
                t.swatches[3]!,
              ] as const;

              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => void setPaletteId(id)}
                  style={({ pressed }) => [
                    LIST_ROW,
                    {
                      paddingVertical: ROW_PAD_V,
                      minHeight: ROW_MIN_H + ROW_PAD_V * 2,
                    },
                    selected && { backgroundColor: rgbaFromHex(p, 0.06) },
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <PaletteSwatchStack colors={four} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 16,
                      fontWeight: '600',
                      color: p,
                      letterSpacing: -0.2,
                      marginRight: 8,
                    }}
                    numberOfLines={1}
                  >
                    {t.nameZh}
                  </Text>
                  {showNew ? (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: '#FF3B30',
                        marginRight: selected ? 8 : 0,
                      }}
                    >
                      New!
                    </Text>
                  ) : null}
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={p} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
