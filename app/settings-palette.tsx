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
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROW_BG_DARK = '#2C2C2E';
const PAGE_BG_DARK = '#000000';
const CHECKMARK_GREEN = '#34C759';
const CHECK_CIRCLE_DARK = '#3A3A3C';

/** 四色胶囊叠放：宽 40、重叠 7、高度 31 */
const SWATCH_W = 100;
const SWATCH_H = 31;
const SWATCH_OVERLAP = 45;
const ROW_PAD_V = 9;
const ROW_MIN_H = 32;
const CHECK_SIZE = 19;
const CHECK_ICON = 12;

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
  const { theme, paletteId, setPaletteId, appearance } = useAppPalette();
  const isDark = appearance === 'dark';

  const pageBg = isDark ? PAGE_BG_DARK : theme.pageBg;
  const hintColor = isDark
    ? 'rgba(255,255,255,0.45)'
    : rgbaFromHex(theme.primary, 0.65);
  const nameColor = isDark ? 'rgba(255,255,255,0.72)' : theme.primary;
  const rowBg = isDark ? ROW_BG_DARK : '#FFFFFF';
  const rowBorder = 'transparent';
  const checkCircleBg = isDark ? CHECK_CIRCLE_DARK : 'rgba(0,0,0,0.08)';

  const newSet = new Set<string>(PALETTE_OPTION_NEW_IDS);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 16,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: hintColor,
          marginBottom: 16,
          lineHeight: 20,
          paddingHorizontal: 4,
        }}
      >
        选择一套配色，总览与洞察会同步应用。
      </Text>

      <View style={{ gap: 7 }}>
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
              style={({ pressed }) => ({
                borderRadius: 10,
                paddingVertical: ROW_PAD_V,
                paddingHorizontal: 12,
                backgroundColor: rowBg,
                borderWidth: isDark ? 0 : StyleSheet.hairlineWidth,
                borderColor: rowBorder,
                opacity: pressed ? 0.88 : 1,
                ...(!isDark
                  ? {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                    }
                  : {}),
              })}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  minHeight: ROW_MIN_H,
                }}
              >
                <PaletteSwatchStack colors={four} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 16,
                    fontWeight: '600',
                    color: nameColor,
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
                <View
                  style={{
                    width: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selected ? (
                    <View
                      style={{
                        width: CHECK_SIZE,
                        height: CHECK_SIZE,
                        borderRadius: CHECK_SIZE / 2,
                        backgroundColor: checkCircleBg,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MaterialIcons
                        name="check"
                        size={CHECK_ICON}
                        color={CHECKMARK_GREEN}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
