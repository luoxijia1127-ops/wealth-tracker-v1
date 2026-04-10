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
  effectiveChartBase,
  FX_CODE_LABEL_ZH,
  pickThreeChartTargets,
  unitsOfTargetPerBase,
} from '@/lib/fx-cross-rate';
import {
  ensureFxUsdRatesHistoryBackfill,
  getCachedFxUsdRates,
  getFxUsdRatesHistory,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

export default function SettingsFxScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { theme, appearance } = useAppPalette();
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState<FxUsdMidRates | null>(null);
  const [fxHistory, setFxHistory] = useState<FxUsdMidRates[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');

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
        const u = unitsOfTargetPerBase(h.rates, chartBase, c);
        return typeof u === 'number' && Number.isFinite(u) && u > 0;
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
        (r) => unitsOfTargetPerBase(r.rates, chartBase, code)!
      );
      const baseVal = raw[0]!;
      const indexed = raw.map((v) => (v / baseVal) * 100);
      return {
        code,
        color: lineColors[i]!,
        values: indexed,
      };
    });

    return {
      chartDates: dates,
      multiSeries: series,
      trioPointCount: okRows.length,
    };
  }, [fxHistory, lineColors, chartBase, chartTargets]);

  /** ScrollView 左右各 20 + 走势图卡片左右各 16 */
  const chartW = Math.max(200, windowW - 40 - 32);
  const chartH = 240;

  const codes =
    fx?.rates != null
      ? Object.keys(fx.rates)
          .filter((k) => /^[A-Z]{3}$/.test(k))
          .sort()
      : [];

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
        paddingTop: insets.top + 16,
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
              marginBottom: 16,
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
                marginBottom: 6,
              }}
            >
              汇率走势（近一月）
            </Text>
            <Text style={{ fontSize: 12, color: muted, marginBottom: 4 }}>
              基准：{FX_CODE_LABEL_ZH[chartBase] ?? chartBase}（{chartBase}）
              {chartBase !== displayCurrency.trim().toUpperCase()
                ? ` · 默认货币为 ${displayCurrency}，历史仅含主要币种对时走势按人民币基准`
                : ''}
            </Text>
            <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
              1 {chartBase} 可兑换多少目标币种（指数化，窗口内首日=100）
            </Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 14,
                marginBottom: 12,
              }}
            >
              {chartTargets.map((code, i) => (
                <View
                  key={code}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: lineColors[i],
                    }}
                  />
                  <Text
                    style={{ fontSize: 13, fontWeight: '600', color: secondary }}
                  >
                    {FX_CODE_LABEL_ZH[code] ?? code} ({code})
                  </Text>
                </View>
              ))}
            </View>
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
                series={multiSeries}
                width={chartW}
                height={chartH}
                gridStroke={theme.chartGridStroke}
                axisLabelColor={axisMuted}
                formatY={(n) => n.toFixed(2)}
              />
            )}
            {chartDates.length >= 2 ? (
              <Text style={{ fontSize: 11, color: muted, marginTop: 8 }}>
                窗口内共 {chartDates.length} 个交易日 · 平滑曲线
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
                暂无当日汇率快照。请在总览下拉同步行情或触发一次净值折算，成功后会显示各币种相对{' '}
                {FX_CODE_LABEL_ZH[tableBase] ?? tableBase} 的比价。
              </Text>
            ) : (
              <>
                {showBaseFallbackNote ? (
                  <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                    当前缓存中暂无 {displayCurrency}{' '}
                    的串联报价，下列仍按 1 USD = 各币种（与接口一致）。
                  </Text>
                ) : (
                  <Text style={{ fontSize: 13, color: muted, marginBottom: 10 }}>
                    语义：1 {tableBase} = 多少目标币种
                  </Text>
                )}
                <Text style={{ fontSize: 13, color: muted, marginBottom: 12 }}>
                  缓存日{fx.shanghaiDate} 
                </Text>
                {codes.slice(0, 16).map((code) => {
                  if (code === tableBase) {
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
                        {code}: 1.000000（基准）
                      </Text>
                    );
                  }
                  const cross = unitsOfTargetPerBase(
                    fx.rates,
                    tableBase,
                    code
                  );
                  const line =
                    cross != null
                      ? `${code}: ${formatTableValue(cross, code)}`
                      : `${code}: ${fx.rates[code]?.toFixed(6) ?? '—'}`;
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
                {codes.length > 16 ? (
                  <Text style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                    … 共 {codes.length} 个币种
                  </Text>
                ) : null}
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
