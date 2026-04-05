/**
 * 汇率缓存说明：资产管理类 app 常用「汇率基准」展示。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { rgbaFromHex } from '@/lib/color-utils';
import { getCachedFxUsdRates, type FxUsdMidRates } from '@/lib/fx-rates';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsFxScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState<FxUsdMidRates | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const r = await getCachedFxUsdRates();
          if (!cancelled) setFx(r);
        } catch {
          if (!cancelled) setFx(null);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const secondary = rgbaFromHex(theme.primary, 0.65);
  const muted = rgbaFromHex(theme.primary, 0.5);

  const codes = fx?.rates
    ? Object.keys(fx.rates).filter((k) => /^[A-Z]{3}$/.test(k)).sort()
    : [];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      <Text style={{ fontSize: 15, lineHeight: 22, color: secondary, marginBottom: 16 }}>
        净值折合人民币时使用 Frankfurter（ECB 口径）USD 基准串联汇率；以下为当前缓存。无网络时沿用最近一次成功拉取。
      </Text>
      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : !fx ? (
        <Text style={{ color: muted }}>暂无汇率缓存。在总览同步行情或触发折算后会自动拉取。</Text>
      ) : (
        <View
          style={{
            borderRadius: 20,
            padding: 16,
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.95)',
          }}
        >
          <Text style={{ fontSize: 13, color: muted, marginBottom: 8 }}>
            缓存日（上海）{fx.shanghaiDate}
          </Text>
          <Text style={{ fontSize: 13, color: muted, marginBottom: 12 }}>
            接口基准日 {fx.apiDate}
          </Text>
          {codes.slice(0, 12).map((code) => (
            <Text
              key={code}
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: theme.primary,
                marginBottom: 6,
              }}
            >
              {code}: {fx.rates[code]?.toFixed(6) ?? '—'}
            </Text>
          ))}
          {codes.length > 12 ? (
            <Text style={{ fontSize: 12, color: muted, marginTop: 4 }}>
              … 共 {codes.length} 个币种
            </Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}
