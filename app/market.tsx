/**
 * 市场大盘：全球指数与外汇等（Stooq 日 K，延迟数分钟～一日，非实时撮合价）。
 */

import { MarketWorldMapCard } from '@/components/market-world-map';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
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
import { AppFont } from '@/lib/app-fonts';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** 涨跌着色：红涨、绿跌（与 A 股看盘习惯一致） */
const RISE = '#e11d48';
const FALL = '#16a34a';

/** 分组左上角小写英文标题（与设置子页 kicker 同层级） */
const SECTION_KICKER: Record<string, string> = {
  us: 'US INDICES',
  asia: 'ASIA PACIFIC',
  eu: 'EUROPE & UK',
  fx: 'FOREIGN EXCHANGE',
  major: 'COMMODITIES & CRYPTO',
};

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const { theme, appearance } = useAppPalette();
  const p = theme.primary;
  const muted = rgbaFromHex(p, 0.55);
  /** 与增加资产表单行图标一致 */
  const iconMuted = useMemo(() => rgbaFromHex(p, 0.5), [p]);
  const mapStroke = useMemo(() => rgbaFromHex(p, 0.38), [p]);
  const listSurface = useMemo(
    () => rgbaFromHex(theme.surfaceWhite, 0.94),
    [theme.surfaceWhite]
  );
  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

  const [quotes, setQuotes] = useState<MarketQuoteResult[]>([]);
  /** 首次从本地缓存恢复完成前为 false，不触发网络请求 */
  const [cacheReady, setCacheReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
    <View style={hubStyles.screen}>
      <View style={hubStyles.screenAmbient} pointerEvents="none" />
      <SettingsHubBackTopBar />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          hubStyles.scrollContent,
          {
            paddingBottom: insets.bottom + 28,
            paddingHorizontal: 0,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshFromNetwork()}
            tintColor={p}
            title={Platform.OS === 'ios' ? '更新中…' : undefined}
            titleColor={muted}
            colors={[p]}
            progressBackgroundColor={
              appearance === 'dark' ? 'rgba(32,32,38,0.98)' : '#ffffff'
            }
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={[hubStyles.mastheadBlock, { paddingTop: 16 }]}>
          <Text style={hubStyles.masthead}>MARKET</Text>
          <Text style={hubStyles.kicker}>INDICES & FX · DELAYED</Text>
        </View>

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
            <View style={{ paddingHorizontal: 24, marginBottom: 10 }}>
              <Text style={hubStyles.kicker}>
                {SECTION_KICKER[sec.key] ?? sec.key.toUpperCase()}
              </Text>
              <Text
                style={{
                  fontFamily: AppFont.displayBold,
                  fontSize: 26,
                  letterSpacing: -0.6,
                  lineHeight: 30,
                  color: p,
                  marginTop: 6,
                }}
              >
                {sec.title}
              </Text>
            </View>
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
