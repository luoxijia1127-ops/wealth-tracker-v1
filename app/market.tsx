/**
 * 市场大盘：全球指数与外汇等（Stooq 日 K，延迟数分钟～一日，非实时撮合价）。
 */

import { MarketWorldMapCard } from '@/components/market-world-map';
import { useAppPalette } from '@/contexts/app-palette-context';
import { editorialAmbientWash } from '@/lib/editorial-theme';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  formatMarketPct,
  formatMarketPrice,
  marketPctColor,
} from '@/lib/market-quote-format';
import {
  fetchAllMarketQuotes,
  MARKET_SECTIONS,
  type MarketQuoteResult,
} from '@/lib/market-quotes';
import {
  loadCachedMarketQuotes,
  saveMarketQuotesCache,
} from '@/lib/market-quotes-cache';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** 涨跌着色：红涨、绿跌（与 A 股看盘习惯一致） */
const RISE = '#e11d48';
const FALL = '#16a34a';

export default function MarketScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  /** 与增加资产表单行图标一致 */
  const iconMuted = useMemo(() => rgbaFromHex(p, 0.5), [p]);
  const mapStroke = useMemo(() => rgbaFromHex(p, 0.38), [p]);
  const listSurface = useMemo(
    () => rgbaFromHex(theme.surfaceWhite, 0.94),
    [theme.surfaceWhite]
  );

  const [quotes, setQuotes] = useState<MarketQuoteResult[]>([]);
  /** 首次从本地缓存恢复完成前为 false，不触发网络请求 */
  const [cacheReady, setCacheReady] = useState(false);
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

  const refreshFromNetwork = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchAllMarketQuotes((partial) => setQuotes([...partial]));
      setQuotes(res);
      await saveMarketQuotesCache(res);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await loadCachedMarketQuotes();
      if (!cancelled) {
        setQuotes(cached);
        setCacheReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAnyPrice = useMemo(
    () => quotes.some((q) => q.price !== null && Number.isFinite(q.price)),
    [quotes]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: editorialAmbientWash(theme),
        }}
      />
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
            onRefresh={() => void refreshFromNetwork()}
            tintColor={p}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!cacheReady ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={p} />
            <Text style={{ marginTop: 12, fontSize: 13, color: muted }}>
              正在读取缓存…
            </Text>
          </View>
        ) : null}

        {cacheReady && !hasAnyPrice && !refreshing ? (
          <Text
            style={{
              fontSize: 13,
              color: muted,
              textAlign: 'center',
              paddingHorizontal: 24,
              paddingBottom: 8,
            }}
          >
            暂无缓存数据，下拉即可加载行情。
          </Text>
        ) : null}

        {cacheReady ? (
          <MarketWorldMapCard
            byId={byId}
            primary={p}
            stroke={mapStroke}
            muted={muted}
            rise={RISE}
            fall={FALL}
          />
        ) : null}

        {cacheReady
          ? MARKET_SECTIONS.map((sec) => (
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
                backgroundColor: listSurface,
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
                const pctColor = marketPctColor(row, {
                  muted,
                  rise: RISE,
                  fall: FALL,
                });
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
                        width: 32,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={iconMuted}
                      />
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
                        {formatMarketPrice(row)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: pctColor,
                          marginTop: 2,
                        }}
                      >
                        {formatMarketPct(row)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))
          : null}

        {cacheReady ? (
          <Text
            style={{
              fontSize: 11,
              lineHeight: 16,
              color: muted,
              paddingHorizontal: 20,
              marginTop: 8,
            }}
          >
            非实时数据，通常有交易日延迟；数值仅供参考，不构成投资建议。
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
