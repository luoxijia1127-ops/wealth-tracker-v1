/**
 * 设置：可选应用配色（ins 风命名 + 五色预览条）
 */

import { useAppPalette } from '@/contexts/app-palette-context';
import { getAssets } from '@/lib/asset-storage';
import {
  APP_PALETTE_THEMES,
  PALETTE_IDS,
  type AppPaletteId,
} from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { getSnapshots } from '@/lib/snapshots';
import { getAssetDailySnapshots } from '@/lib/asset-daily-snapshots';
import { buildDailyTradeSummaries, type DailyTradeSummary } from '@/lib/trade-summary';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme, paletteId, setPaletteId } = useAppPalette();
  const [tradeSummaries, setTradeSummaries] = useState<DailyTradeSummary[]>([]);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setTradeLoading(true);
      (async () => {
        try {
          const [assets, snaps, assetSnaps] = await Promise.all([
            getAssets(),
            getSnapshots(),
            getAssetDailySnapshots(),
          ]);
          const rows = buildDailyTradeSummaries({
            assets,
            snapshots: snaps,
            assetDailySnapshots: assetSnaps,
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

  const cardShadow = useMemo(
    () => ({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    }),
    []
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 28,
        paddingHorizontal: 20,
      }}
      showsVerticalScrollIndicator={false}>
      <Text
        style={{
          fontSize: 28,
          fontWeight: '800',
          letterSpacing: -0.5,
          color: theme.primary,
          marginBottom: 8,
        }}>
        设置
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '500',
          color: rgbaFromHex(theme.primary, 0.65),
          marginBottom: 22,
          lineHeight: 20,
        }}>
        选择一套配色，Dashboard 与 Insights 会同步应用。
      </Text>

      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: theme.primary,
          marginBottom: 12,
          letterSpacing: 0.2,
        }}>
        应用配色
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
              })}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '700',
                    color: t.primary,
                    letterSpacing: -0.2,
                  }}>
                  {t.nameZh}
                </Text>
                {selected ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: t.primary,
                      opacity: 0.85,
                    }}>
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

      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: theme.primary,
          marginTop: 22,
          marginBottom: 12,
          letterSpacing: 0.2,
        }}>
        交易明细汇总
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '500',
          color: rgbaFromHex(theme.primary, 0.62),
          marginBottom: 12,
          lineHeight: 18,
        }}>
        按日期汇总买卖、外部入金/出金与每日净值快照变动。买入/加仓这类内部划转不会计入外部现金流；“市场/其它”按
        净值变动减去外部净流入得到。
      </Text>

      <View style={{ gap: 10 }}>
        {tradeLoading ? (
          <View
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: '#FFFFFF',
              ...cardShadow,
            }}>
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
            }}>
            <Text style={{ color: rgbaFromHex(theme.primary, 0.7), fontWeight: '600' }}>
              暂无汇总数据。请先在 Dashboard 同步行情生成净值快照，并产生交易/现金流水。
            </Text>
          </View>
        ) : (
          tradeSummaries.slice(0, 30).map((d) => {
            const open = expandedDate === d.date;
            const diff = d.snapshotDiff;
            const diffColor =
              typeof diff === 'number'
                ? diff > 0
                  ? '#22A06B'
                  : diff < 0
                    ? '#DC2626'
                    : rgbaFromHex(theme.primary, 0.7)
                : rgbaFromHex(theme.primary, 0.7);
            return (
              <View
                key={d.date}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: '#FFFFFF',
                  ...cardShadow,
                }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedDate(open ? null : d.date)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.primary }}>
                      {d.date}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: diffColor }}>
                      {typeof diff === 'number'
                        ? `净值变动 ${diff >= 0 ? '+' : ''}${Math.round(diff).toLocaleString()}`
                        : '无快照变动'}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: theme.primary }}>
                      {open ? '收起' : '展开'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: '600',
                      color: rgbaFromHex(theme.primary, 0.65),
                      lineHeight: 18,
                    }}>
                    买入 ¥{Math.round(d.buyAmountCny).toLocaleString()} · 卖出 ¥
                    {Math.round(d.sellAmountCny).toLocaleString()} · 外部净流入 ¥
                    {Math.round(d.externalNetFlow).toLocaleString()}
                    {d.residual !== null
                      ? d.residualMarketExplained !== null
                        ? ` · 残差：可解释 ¥${Math.round(
                            d.residualMarketExplained
                          ).toLocaleString()} / 未解释 ¥${Math.round(
                            d.residualUnexplained ?? 0
                          ).toLocaleString()}`
                        : ` · 市场/其它 ¥${Math.round(d.residual).toLocaleString()}`
                      : ''}
                  </Text>
                </Pressable>

                {open ? (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    {d.residual !== null ? (
                      <View style={{ gap: 6 }}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: theme.primary,
                          }}>
                          残差拆解（净值变动 - 外部净流入）
                        </Text>
                        {d.residualMarketExplained !== null ? (
                          <>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: rgbaFromHex(theme.primary, 0.7),
                                lineHeight: 18,
                              }}>
                              可解释（按资产市值快照计算的市场/估值变化）：¥
                              {Math.round(d.residualMarketExplained).toLocaleString()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: rgbaFromHex(theme.primary, 0.7),
                                lineHeight: 18,
                              }}>
                              未解释（缺少资产快照/跨币种等）：¥
                              {Math.round(d.residualUnexplained ?? 0).toLocaleString()}
                            </Text>
                            {d.topMarketMovers && d.topMarketMovers.length > 0 ? (
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '700',
                                  color: rgbaFromHex(theme.primary, 0.6),
                                  lineHeight: 18,
                                }}>
                                主要贡献：{d.topMarketMovers
                                  .map(
                                    (m) =>
                                      `${m.assetName} ${m.delta >= 0 ? '+' : ''}${Math.round(
                                        m.delta
                                      ).toLocaleString()}`
                                  )
                                  .join(' · ')}
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: rgbaFromHex(theme.primary, 0.65),
                              lineHeight: 18,
                            }}>
                            暂无资产市值快照用于拆解。请在 Dashboard 同步行情后再查看（会自动写入每日资产快照）。
                          </Text>
                        )}
                      </View>
                    ) : null}
                    {d.lines.length === 0 ? (
                      <Text style={{ color: rgbaFromHex(theme.primary, 0.6), fontWeight: '600' }}>
                        当天无流水记录
                      </Text>
                    ) : (
                      d.lines.slice(0, 30).map((x, idx) => {
                        if (x.kind === 'trade') {
                          const side = x.side === 'buy' ? '买入' : '卖出';
                          const sColor = x.side === 'buy' ? '#DC2626' : '#22A06B';
                          return (
                            <Text
                              key={`${x.kind}-${idx}-${x.assetId}`}
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: rgbaFromHex(theme.primary, 0.7),
                                lineHeight: 18,
                              }}>
                              <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text>{' '}
                              {x.assetName} · {x.qty} @ ¥{x.unitPriceCny.toFixed(4)} · ¥
                              {Math.round(x.amountCny).toLocaleString()}
                              {x.fundingSourceName ? ` · 来源 ${x.fundingSourceName}` : ''}
                            </Text>
                          );
                        }
                        const side = x.side === 'in' ? '入金' : '出金';
                        const sColor = x.side === 'in' ? '#22A06B' : '#DC2626';
                        const tag = x.internal ? '内部' : '外部';
                        return (
                          <Text
                            key={`${x.kind}-${idx}-${x.assetId}`}
                            style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: rgbaFromHex(theme.primary, 0.7),
                              lineHeight: 18,
                            }}>
                            <Text style={{ color: sColor, fontWeight: '800' }}>{side}</Text>{' '}
                            {x.assetName} · ¥{Math.round(x.amount).toLocaleString()} · {tag}
                            {x.relatedAssetName ? ` · 关联 ${x.relatedAssetName}` : ''}
                            {x.note ? ` · ${x.note}` : ''}
                          </Text>
                        );
                      })
                    )}
                    {d.lines.length > 30 ? (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: rgbaFromHex(theme.primary, 0.55) }}>
                        仅展示前 30 条，更多可在资产详情的流水中查看
                      </Text>
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
