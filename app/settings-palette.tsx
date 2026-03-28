/**
 * 应用配色：从设置网格进入，选择 ins 风主题。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import {
  APP_PALETTE_THEMES,
  PALETTE_IDS,
  type AppPaletteId,
} from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsPaletteScreen() {
  const insets = useSafeAreaInsets();
  const { theme, paletteId, setPaletteId } = useAppPalette();

  return (
    <ScrollView
        style={{ flex: 1, backgroundColor: theme.pageBg }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: '500',
            color: rgbaFromHex(theme.primary, 0.65),
            marginBottom: 18,
            lineHeight: 20,
          }}
        >
          选择一套配色，Dashboard 与 Insights 会同步应用。
        </Text>

        <View style={{ gap: 12 }}>
          {PALETTE_IDS.map((id: AppPaletteId) => {
            const t = APP_PALETTE_THEMES[id];
            const selected = paletteId === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => void setPaletteId(id)}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: '#FFFFFF',
                  borderWidth: selected ? 2.5 : StyleSheet.hairlineWidth,
                  borderColor: selected ? t.primary : 'rgba(0,0,0,0.08)',
                  opacity: pressed ? 0.92 : 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: selected ? 0.1 : 0.05,
                  shadowRadius: 12,
                  elevation: selected ? 3 : 2,
                })}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '700',
                      color: t.primary,
                      letterSpacing: -0.2,
                    }}
                  >
                    {t.nameZh}
                  </Text>
                  {selected ? (
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
                        color: t.primary,
                        opacity: 0.85,
                      }}
                    >
                      当前
                    </Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 6, height: 10 }}>
                  {t.swatches.map((hex) => (
                    <View
                      key={hex}
                      style={{
                        flex: 1,
                        borderRadius: 5,
                        backgroundColor: hex,
                      }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
  );
}
