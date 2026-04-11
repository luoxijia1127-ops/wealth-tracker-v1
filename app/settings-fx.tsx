/**
 * 汇率说明：Frankfurter（ECB 口径）USD 串联存库；展示时按「设置 · 默认货币」为基准换算。
 */

import {
  FxMultiTrendChart,
  type FxMultiSeries,
} from '@/components/fx-multi-trend-chart';
import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { loadDisplayCurrency } from '@/lib/display-currency-preference';
import {
  basePerOneTarget,
  effectiveChartBase,
  FX_CODE_LABEL_ZH,
  pickThreeChartTargets,
} from '@/lib/fx-cross-rate';
import {
  ensureFxUsdRatesHistoryBackfill,
  getCachedFxUsdRates,
  getFxUsdRatesHistory,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function trioLineColors(t: AppPaletteTheme): [string, string, string] {
  const g = t.goalRingColors;
  if (g.length >= 3) return [g[0]!, g[1]!, g[2]!];
  return [t.chartLine, t.swatches[1]!, t.swatches[3]!];
}

function formatTableValue(n: number, target: string): string {
  if (target === 'JPY' || target === 'KRW') return n.toFixed(4);
  if (n >= 100) return n.toFixed(4);
  if (n >= 10) return n.toFixed(5);
  return n.toFixed(6);
}

/** 走势图纵轴：与汇率数量级匹配的位数 */
function formatChartAxisY(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(2);
  if (a >= 10) return n.toFixed(3);
  return n.toFixed(4);
}

export default function SettingsFxScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { theme, appearance } = useAppPalette();
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState<FxUsdMidRates | null>(null);
  const [fxHistory, setFxHistory] = useState<FxUsdMidRates[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
  const [selectedChartCode, setSelectedChartCode] = useState<string | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          try {
            await ensureFxUsdRatesHistoryBackfill();
          } catch {
            /* 回填失败仍展示已有本地历史 */
          }
          const dc = await loadDisplayCurrency();
          const [r, hist] = await Promise.all([
            getCachedFxUsdRates(),
            getFxUsdRatesHistory(),
          ]);
          if (!cancelled) {
            setDisplayCurrency(dc);
            setFx(r);
            setFxHistory(hist);
          }
        } catch {
          if (!cancelled) {
            setFx(null);
            setFxHistory([]);
          }
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

  const axisMuted =
    appearance === 'dark'
      ? 'rgba(255,255,255,0.45)'
      : rgbaFromHex(theme.primary, 0.42);

  const lineColors = useMemo(() => trioLineColors(theme), [theme]);

  const chartBase = useMemo(
    () => effectiveChartBase(displayCurrency),
    [displayCurrency]
  );

  const chartTargets = useMemo(
    () => pickThreeChartTargets(chartBase),
    [chartBase]
  );

  const { chartDates, multiSeries, trioPointCount } = useMemo(() => {
    const today = getShanghaiDateString();
    const windowStart = addCalendarDaysYmd(today, -30);
    const rows = fxHistory
      .filter(
        (h) =>
          h.shanghaiDate >= windowStart && h.shanghaiDate <= today
      )
      .sort((a, b) => a.shanghaiDate.localeCompare(b.shanghaiDate));

    const codes = chartTargets;
    const okRows = rows.filter((h) =>
      codes.every((c) => {
        const v = basePerOneTarget(h.rates, chartBase, c);
        return typeof v === 'number' && Number.isFinite(v) && v > 0;
      })
    );

    if (okRows.length < 2) {
      return {
        chartDates: [] as string[],
        multiSeries: [] as FxMultiSeries[],
        trioPointCount: okRows.length,
      };
    }

    const dates = okRows.map((r) => r.shanghaiDate);
    const series: FxMultiSeries[] = codes.map((code, i) => {
      const raw = okRows.map(
        (r) => basePerOneTarget(r.rates, chartBase, code)!
      );
      return {
        code,
        color: lineColors[i]!,
        values: raw,
      };
    });

    return {
      chartDates: dates,
      multiSeries: series,
      trioPointCount: okRows.length,
    };
  }, [fxHistory, lineColors, chartBase, chartTargets]);

  useEffect(() => {
    if (multiSeries.length === 0) return;
    setSelectedChartCode((prev) =>
      prev != null && multiSeries.some((s) => s.code === prev)
        ? prev
        : multiSeries[0]!.code
    );
  }, [multiSeries]);

  const chartSeriesForView = useMemo(() => {
    if (multiSeries.length === 0) return [];
    const code = selectedChartCode;
    const one =
      code != null ? multiSeries.find((s) => s.code === code) : undefined;
    return one ? [one] : [multiSeries[0]!];
  }, [multiSeries, selectedChartCode]);

  /** ScrollView 左右各 20 + 走势图卡片左右各 16 */
  const chartW = Math.max(200, windowW - 40 - 32);
  const chartH = 240;

  /** 列表基准：默认货币在缓存中有有效串联价则用，否则退回 USD 展示原始 API 语义 */
  const tableBase = useMemo(() => {
    if (!fx?.rates) return 'USD';
    const dc = /^[A-Z]{3}$/.test(displayCurrency) ? displayCurrency : 'CNY';
    if (dc === 'USD') return 'USD';
    const rv = fx.rates[dc as keyof typeof fx.rates];
    if (typeof rv === 'number' && rv > 0) return dc;
    return 'USD';
  }, [fx, displayCurrency]);

  const showBaseFallbackNote =
    fx != null &&
    tableBase !== displayCurrency &&
    /^[A-Z]{3}$/.test(displayCurrency);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.pageBg }}
      contentContainerStyle={{
        paddingTop: 12,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 20,
      }}
    >
      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <>
          <View
            style={{
              borderRadius: 20,
              padding: 16,
              marginBottom: 8,
              overflow: 'hidden',
              backgroundColor:
                appearance === 'dark'
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(255,255,255,0.94)',
              borderWidth: 1,
              borderColor:
                appearance === 'dark'
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.95)',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '700',
                color: theme.primary,
                marginBottom: 4,
              }}
            >
              汇率走势（近一月）
            </Text>
            <Text style={{ fontSize: 12, color: muted, marginBottom: 8 }}>
              基准：{FX_CODE_LABEL_ZH[chartBase] ?? chartBase}（{chartBase}）
              {chartBase !== displayCurrency.trim().toUpperCase()
                ? ` · 默认货币为 ${displayCurrency}，历史仅含主要币种对时走势按人民币基准`
                : ''}
            </Text>
            {multiSeries.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  paddingBottom: 6,
                  width: '100%',
                }}
              >
                  {multiSeries.map((s, i) => {
                    const selected = s.code === selectedChartCode;
                    return (
                      <Pressable
                        key={s.code}
                        onPress={() => setSelectedChartCode(s.code)}
                        style={{
                          paddingHorizontal: 11,
                          paddingVertical: 5,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: selected
                            ? theme.primary
                            : appearance === 'dark'
                              ? 'rgba(255,255,255,0.14)'
                              : rgbaFromHex(theme.primary, 0.2),
                          backgroundColor: selected
                            ? rgbaFromHex(theme.primary, 0.12)
                            : appearance === 'dark'
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(255,255,255,0.65)',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: lineColors[i],
                            }}
                          />
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: theme.primary,
                            }}
                          >
                            {FX_CODE_LABEL_ZH[s.code] ?? s.code}{' '}
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '600',
                                color: secondary,
                              }}
                            >
                              {s.code}
                            </Text>
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
              </View>
            ) : null}
            {fxHistory.length === 0 ? (
              <Text style={{ fontSize: 14, color: muted }}>
                尚未累积按日历史。打开总览后会自动尝试回填近 30 日序列；亦可下拉同步行情。
              </Text>
            ) : multiSeries.length === 0 || chartDates.length < 2 ? (
              <Text style={{ fontSize: 14, color: muted }}>
                近一月内有效数据点不足（至少 2
                个交易日，且需能计算基准对
                {chartTargets.join('、')}
                ）。请联网同步或稍后再试。
                {trioPointCount > 0 && trioPointCount < 2
                  ? ` 当前仅有 ${trioPointCount} 日。`
                  : ''}
              </Text>
            ) : (
              <FxMultiTrendChart
                dates={chartDates}
                series={chartSeriesForView}
                width={chartW}
                height={chartH}
                gridStroke={theme.chartGridStroke}
                axisLabelColor={axisMuted}
                formatY={formatChartAxisY}
              />
            )}
            {chartDates.length >= 2 ? (
              <Text style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                窗口内共 {chartDates.length} 个交易日 · 当前：
                {chartSeriesForView[0]?.code ?? '—'} 相对{' '}
                {FX_CODE_LABEL_ZH[chartBase] ?? chartBase} 的绝对比价走势
              </Text>
            ) : null}
          </View>

          <View
            style={{
              borderRadius: 20,
              padding: 16,
              backgroundColor:
                appearance === 'dark'
                  ? 'rgba(255,255,255,0.07)'
                  : 'rgba(255,255,255,0.94)',
              borderWidth: 1,
              borderColor:
                appearance === 'dark'
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.95)',
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: theme.primary,
                marginBottom: 8,
              }}
            >
              当前缓存中间价
            </Text>
            {!fx ? (
              <Text style={{ fontSize: 14, color: muted }}>
                暂无当日汇率快照。请在总览下拉同步行情或触发一次净值折算，成功后会显示与上图一致的三条目标币种比价。
              </Text>
            ) : (
              <>
                {showBaseFallbackNote ? (
                  <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                    当前缓存中暂无 {displayCurrency}{' '}
                    的串联报价，下列仍按 1 USD = 各币种（与接口一致）。
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, color: muted, marginBottom: 12 }}>
                  缓存日{fx.shanghaiDate}
                </Text>
                {chartTargets.map((code) => {
                  const cross = basePerOneTarget(fx.rates, chartBase, code);
                  const line =
                    cross != null
                      ? `${code}: ${formatTableValue(cross, code)}`
                      : `${code}: —`;
                  return (
                    <Text
                      key={code}
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: theme.primary,
                        marginBottom: 6,
                      }}
                    >
                      {line}
                    </Text>
                  );
                })}
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
