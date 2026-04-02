/**
 * 净值变动归因：按日对照总净值快照变化（从设置网格进入）。
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets } from '@/lib/asset-storage';
import { rgbaFromHex } from '@/lib/color-utils';
import { getSnapshots } from '@/lib/snapshots';
import { getAssetDailySnapshots } from '@/lib/asset-daily-snapshots';
import {
  createFxRatesResolver,
  getCachedFxUsdRates,
  getFxUsdRatesHistory,
} from '@/lib/fx-rates';
import {
  financeDeltaColor,
  FINANCE_DOWN,
  FINANCE_UP,
} from '@/lib/finance-colors';
import {
  buildDailyTradeSummaries,
  filterInternalTradeLines,
  filterTradeLinesForDisplay,
  type DailyTradeLine,
  type DailyTradeSummary,
} from '@/lib/trade-summary';
import { CATEGORY_LABEL_ZH } from '@/types/asset';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtMoney(n: number): string {
  const r = Math.round(n);
  const sign = r > 0 ? '+' : '';
  return `${sign}¥${Math.abs(r).toLocaleString()}`;
}

function deltaColor(v: number, themeMuted: string): string {
  return financeDeltaColor(v, themeMuted);
}

function renderTradeLine(
  x: DailyTradeLine,
  idx: number,
  themePrimary: string
): ReactNode {
  if (x.kind === 'trade') {
    const side = x.side === 'buy' ? '买' : '卖';
    const sColor = x.side === 'buy' ? FINANCE_UP : FINANCE_DOWN;
    return (
      <Text
        key={`t-${idx}-${x.assetId}`}
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: rgbaFromHex(themePrimary, 0.72),
          lineHeight: 18,
        }}
      >
        <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text> {x.assetName} ·{' '}
        {fmtMoney(x.side === 'buy' ? -x.amountCny : x.amountCny)}
      </Text>
    );
  }
  const side = x.side === 'in' ? '增' : '减';
  const sColor = x.side === 'in' ? FINANCE_UP : FINANCE_DOWN;
  return (
    <Text
      key={`c-${idx}-${x.assetId}`}
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: rgbaFromHex(themePrimary, 0.72),
        lineHeight: 18,
      }}
    >
      <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text> {x.assetName} ·{' '}
      {fmtMoney(x.side === 'in' ? x.amount : -x.amount)}
    </Text>
  );
}

export default function SettingsAttributionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppPalette();
  const params = useLocalSearchParams<{ focusDate?: string }>();
  const [tradeSummaries, setTradeSummaries] = useState<DailyTradeSummary[]>([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [internalOpenDate, setInternalOpenDate] = useState<string | null>(null);

  useEffect(() => {
    const raw = params.focusDate;
    const fd =
      typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    if (!fd || tradeLoading || tradeSummaries.length === 0) return;
    if (tradeSummaries.some((r) => r.date === fd)) {
      setExpandedDate(fd);
    }
  }, [params.focusDate, tradeSummaries, tradeLoading]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setTradeLoading(true);
      (async () => {
        try {
          const [assets, snaps, assetSnaps, fx, fxHistory] = await Promise.all([
            getAssets(),
            getSnapshots(),
            getAssetDailySnapshots(),
            getCachedFxUsdRates(),
            getFxUsdRatesHistory(),
          ]);
          const resolveFxRates = createFxRatesResolver(
            fxHistory,
            fx?.rates ?? null
          );
          const rows = buildDailyTradeSummaries({
            assets,
            snapshots: snaps,
            assetDailySnapshots: assetSnaps,
            usdRates: fx?.rates ?? null,
            resolveFxRates,
          });
          if (!cancelled) setTradeSummaries(rows);
        } catch {
          if (!cancelled) setTradeSummaries([]);
        } finally {
          if (!cancelled) setTradeLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  };

  const muted = rgbaFromHex(theme.primary, 0.62);

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
          fontSize: 12,
          fontWeight: '500',
          color: muted,
          marginBottom: 14,
          lineHeight: 18,
        }}
      >
        按日对照「总净值快照」变化（折人民币时与 Dashboard 一致）。持仓市值变动含两日均有持仓的涨跌，以及新进/清仓资产；
        外币逐资产折算使用「汇率历史」：当日市值按当日（或最近可用）中间价、前一日市值按前一日中间价，以减少与总净值口径差。外部净流入为现金类非内部划转；与现金账户成对的股票买卖默认折叠为「内部划转」。
      </Text>

      <View style={{ gap: 10 }}>
        {tradeLoading ? (
          <View
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: '#FFFFFF',
              ...cardShadow,
            }}
          >
            <Text style={{ color: rgbaFromHex(theme.primary, 0.7), fontWeight: '600' }}>
              加载中…
            </Text>
          </View>
        ) : tradeSummaries.length === 0 ? (
          <View
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: '#FFFFFF',
              ...cardShadow,
            }}
          >
            <Text style={{ color: rgbaFromHex(theme.primary, 0.7), fontWeight: '600' }}>
              暂无数据。请先同步行情生成净值快照；有外部现金或独立证券成交后会出现归因。
            </Text>
          </View>
        ) : (
          tradeSummaries.slice(0, 30).map((d) => {
            const open = expandedDate === d.date;
            const diff = d.snapshotDiff;
            const diffColor =
              typeof diff === 'number' ? deltaColor(diff, muted) : muted;

            const market =
              d.residualMarketExplained !== null ? d.residualMarketExplained : null;
            const heldAtt = d.attributionHeld;
            const openCloseAtt = d.attributionOpenClose;
            const ext = d.externalNetFlow;
            const unexplained = d.residualUnexplained;
            const showUnexplained =
              unexplained !== null && Math.abs(unexplained) >= 1;

            const displayLines = filterTradeLinesForDisplay(d.lines);
            const internalLines = filterInternalTradeLines(d.lines);
            const internalOpen = internalOpenDate === d.date;

            return (
              <View
                key={d.date}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: '#FFFFFF',
                  ...cardShadow,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedDate(open ? null : d.date)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>
                      {d.date}
                    </Text>
                    {typeof diff === 'number' ? (
                      <Text style={{ fontSize: 14, fontWeight: '800', color: diffColor }}>
                        净值 {fmtMoney(diff)}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>
                        无连续快照
                      </Text>
                    )}
                    <View style={{ flex: 1, minWidth: 8 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                      {open ? '收起' : '明细'}
                    </Text>
                  </View>

                  {typeof diff === 'number' ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                        {market !== null ? (
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                            逐资产合计{' '}
                            <Text style={{ color: deltaColor(market, muted) }}>
                              {fmtMoney(market)}
                            </Text>
                          </Text>
                        ) : null}
                        <Text style={{ fontSize: 13, fontWeight: '700', color: theme.primary }}>
                          外部净流{' '}
                          <Text style={{ color: deltaColor(ext, muted) }}>
                            {fmtMoney(ext)}
                          </Text>
                        </Text>
                      </View>
                      {typeof heldAtt === 'number' || typeof openCloseAtt === 'number' ? (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: rgbaFromHex(theme.primary, 0.55),
                            lineHeight: 16,
                          }}
                        >
                          {typeof heldAtt === 'number' ? (
                            <>持仓涨跌 {fmtMoney(heldAtt)}</>
                          ) : null}
                          {typeof heldAtt === 'number' && typeof openCloseAtt === 'number'
                            ? ' · '
                            : null}
                          {typeof openCloseAtt === 'number' ? (
                            <>新进/清仓 {fmtMoney(openCloseAtt)}</>
                          ) : null}
                        </Text>
                      ) : null}
                      {showUnexplained ? (
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: muted,
                            lineHeight: 16,
                          }}
                        >
                          口径差 {fmtMoney(unexplained!)}（历史汇率缺失日回退当前缓存、现金外币流水、舍入等）
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>

                {open ? (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    {displayLines.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: rgbaFromHex(theme.primary, 0.55),
                            letterSpacing: 0.3,
                          }}
                        >
                          外部与独立成交
                        </Text>
                        {displayLines.slice(0, 40).map((x, idx) =>
                          renderTradeLine(x, idx, theme.primary)
                        )}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '600', color: muted }}>
                        当日无非内部流水
                      </Text>
                    )}

                    {internalLines.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        <Pressable
                          onPress={() =>
                            setInternalOpenDate(internalOpen ? null : d.date)
                          }
                          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: muted }}>
                            内部划转 {internalLines.length} 笔 · {internalOpen ? '收起' : '展开'}
                          </Text>
                        </Pressable>
                        {internalOpen ? (
                          <View style={{ gap: 4, paddingLeft: 4 }}>
                            {internalLines.slice(0, 40).map((x, idx) =>
                              renderTradeLine(x, idx, theme.primary)
                            )}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    {d.topMarketMovers && d.topMarketMovers.length > 0 && market !== null ? (
                      <View style={{ gap: 8 }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '800',
                            color: rgbaFromHex(theme.primary, 0.55),
                            letterSpacing: 0.3,
                          }}
                        >
                          市值贡献
                        </Text>
                        {d.topMarketMovers.map((m, idx) => (
                          <View
                            key={`${m.assetName}-${idx}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: theme.primary,
                                }}
                                numberOfLines={2}
                              >
                                {m.assetName}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '600',
                                  color: muted,
                                  marginTop: 2,
                                }}
                              >
                                {CATEGORY_LABEL_ZH[m.category]}
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: deltaColor(m.delta, muted),
                                }}
                              >
                                {fmtMoney(m.delta)}
                              </Text>
                              {m.liquidated ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: muted,
                                    marginTop: 2,
                                  }}
                                >
                                  清仓
                                </Text>
                              ) : m.dailyReturnPct !== null ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: financeDeltaColor(m.dailyReturnPct, muted),
                                    marginTop: 2,
                                  }}
                                >
                                  {m.dailyReturnPct >= 0 ? '+' : ''}
                                  {m.dailyReturnPct.toFixed(2)}%
                                </Text>
                              ) : m.opened ? (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: muted,
                                    marginTop: 2,
                                  }}
                                >
                                  新进
                                </Text>
                              ) : (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    fontWeight: '700',
                                    color: muted,
                                    marginTop: 2,
                                  }}
                                >
                                  —
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
