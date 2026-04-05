/**
 * 默认展示货币（汇总与部分文案；资产本币不变）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { ASSET_CURRENCY_OPTIONS } from '@/lib/asset-currency';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  loadDisplayCurrency,
  saveDisplayCurrency,
} from '@/lib/display-currency-preference';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsDisplayCurrencyScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const [code, setCode] = useState<string>('CNY');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadDisplayCurrency().then((c) => {
      if (!cancelled) {
        setCode(c);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onPick = useCallback(async (next: string) => {
    setCode(next);
    await saveDisplayCurrency(next);
  }, []);

  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: muted,
          marginBottom: 16,
          lineHeight: 20,
        }}
      >
        用于总览与洞察中的净值汇总与分布分析；各资产仍以各自币种记录，多持仓按中间价折为该货币。
      </Text>
      {loading ? (
        <ActivityIndicator color={p} />
      ) : (
        <View style={{ gap: 10 }}>
          {ASSET_CURRENCY_OPTIONS.map((o) => {
            const selected = code === o.code;
            return (
              <Pressable
                key={o.code}
                onPress={() => void onPick(o.code)}
                style={({ pressed }) => ({
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  backgroundColor: '#FFFFFF',
                  borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  borderColor: selected ? p : 'rgba(0,0,0,0.08)',
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: p }}>
                  {o.symbol} {o.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
