/**
 * 市场大盘：全球指数与外汇等（Stooq 日 K，延迟数分钟～一日，非实时撮合价）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import {
  fetchAllMarketQuotes,
  MARKET_SECTIONS,
  type MarketQuoteResult,
} from '@/lib/market-quotes';
import { rgbaFromHex } from '@/lib/color-utils';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const UP = '#16a34a';
const DOWN = '#e11d48';

function formatPrice(q: MarketQuoteResult): string {
  const p = q.price;
  if (p === null || !Number.isFinite(p)) return '—';
  const sym = q.def.symbol;
  const isFx =
    sym.includes('usd') ||
    sym.includes('eur') ||
    sym.includes('jpy') ||
    sym.includes('hkd') ||
    sym.includes('rub') ||
    sym.includes('cny');
  if (isFx && p < 200) return p.toFixed(4);
  if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 3 });
  return p.toFixed(3);
}

function formatPct(q: MarketQuoteResult): string {
  const c = q.changePct;
  if (c === null || !Number.isFinite(c)) return '—';
  const sign = c > 0 ? '+' : '';
  return `${sign}${c.toFixed(2)}%`;
}

export default function MarketScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  const surface = 'rgba(255,255,255,0.94)';

  const [quotes, setQuotes] = useState<MarketQuoteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.pageBg },
      headerTintColor: p,
      headerTitleStyle: { fontWeight: '700', color: p },
    });
  }, [navigation, theme.pageBg, p]);

  const byId = useMemo(() => {
    const m = new Map<string, MarketQuoteResult>();
    for (const q of quotes) m.set(q.def.id, q);
    return m;
  }, [quotes]);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetchAllMarketQuotes((partial) => setQuotes([...partial]));
      setQuotes(res);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 0,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={p}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && quotes.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={p} />
            <Text style={{ marginTop: 12, fontSize: 13, color: muted }}>
              正在拉取行情…
            </Text>
          </View>
        ) : null}

        {MARKET_SECTIONS.map((sec) => (
          <View key={sec.key} style={{ marginBottom: 18 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '800',
                color: p,
                paddingHorizontal: 18,
                marginBottom: 8,
              }}
            >
              {sec.title}
            </Text>
            <View
              style={{
                marginHorizontal: 14,
                borderRadius: 16,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              {sec.items.map((item, idx) => {
                const q = byId.get(item.id);
                const row = q ?? {
                  def: item,
                  price: null,
                  changePct: null,
                  asOfDate: null,
                };
                const up = row.changePct !== null && row.changePct > 0;
                const down = row.changePct !== null && row.changePct < 0;
                const pctColor =
                  row.changePct === null
                    ? muted
                    : up
                      ? UP
                      : down
                        ? DOWN
                        : muted;
                const isLast = idx === sec.items.length - 1;
                return (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderBottomWidth: isLast ? 0 : 1,
                      borderBottomColor: 'rgba(0,0,0,0.06)',
                      minHeight: 56,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0,0,0,0.04)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '600',
                          color: p,
                        }}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', minWidth: 108 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: p,
                        }}
                        numberOfLines={1}
                      >
                        {formatPrice(row)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: pctColor,
                          marginTop: 2,
                        }}
                      >
                        {formatPct(row)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <Text
          style={{
            fontSize: 11,
            lineHeight: 16,
            color: muted,
            paddingHorizontal: 20,
            marginTop: 8,
          }}
        >
          非实时数据，来自 Stooq 日 K，通常有交易日延迟；数值仅供参考，不构成投资建议。
        </Text>
      </ScrollView>
    </View>
  );
}
