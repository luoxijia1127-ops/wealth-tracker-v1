/**
 * 汇率说明：Frankfurter（ECB 口径）USD 串联存库；展示时按「设置 · 默认货币」为基准换算。
 */

import {
  FxMultiTrendChart,
  type FxMultiSeries,
} from '@/components/fx-multi-trend-chart';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { ASSET_CURRENCY_OPTIONS } from '@/lib/asset-currency';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import { loadDisplayCurrency } from '@/lib/display-currency-preference';
import {
  basePerOneTarget,
  effectiveChartBase,
  FX_CODE_LABEL_ZH,
  pickFxMonthlyChartTargets,
} from '@/lib/fx-cross-rate';
import {
  ensureFxUsdRatesHistoryBackfill,
  getCachedFxUsdRates,
  getFxUsdRatesHistory,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { AppFont } from '@/lib/app-fonts';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import {
  formatRateOrSmallNumberOneLine,
  numberSingleLineTextProps,
} from '@/lib/numeric-display-one-line';
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

/** 走势线颜色（主五币场景下最多 5 条） */
function chartLineColors(t: AppPaletteTheme, count: number): string[] {
  const g = t.goalRingColors;
  const fb = [
    t.chartLine,
    t.swatches[1]!,
    t.swatches[3]!,
    t.swatches[2] ?? t.swatches[0]!,
  ];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (g.length > i) out.push(g[i]!);
    else out.push(fb[i % fb.length]!);
  }
  return out;
}

function formatTableValue(n: number, target: string): string {
  return formatRateOrSmallNumberOneLine(n, target);
}

export default function SettingsFxScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const { theme, appearance } = useAppPalette();
  const [loading, setLoading] = useState(true);
  const [fx, setFx] = useState<FxUsdMidRates | null>(null);
  const [fxHistory, setFxHistory] = useState<FxUsdMidRates[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState<string>('CNY');
  /** 单卡内切换：当前展示走势的主五币目标代码 */
  const [selectedFxCode, setSelectedFxCode] = useState<string | null>(null);

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

  const muted = rgbaFromHex(theme.primary, 0.5);

  const axisMuted =
    appearance === 'dark'
      ? 'rgba(255,255,255,0.45)'
      : rgbaFromHex(theme.primary, 0.42);

  const chartBase = useMemo(
    () => effectiveChartBase(displayCurrency),
    [displayCurrency]
  );

  const monthlyWindowRows = useMemo(() => {
    const today = getShanghaiDateString();
    const windowStart = addCalendarDaysYmd(today, -30);
    return fxHistory
      .filter(
        (h) =>
          h.shanghaiDate >= windowStart && h.shanghaiDate <= today
      )
      .sort((a, b) => a.shanghaiDate.localeCompare(b.shanghaiDate));
  }, [fxHistory]);

  /** 各目标币种独立筛交易日；单卡内通过图标只展示其一 */
  const fxMonthlySeriesByCode = useMemo(() => {
    const targets = pickFxMonthlyChartTargets(chartBase);
    const colorList = chartLineColors(theme, Math.max(targets.length, 5));
    return targets.map((code, i) => {
      const okRows = monthlyWindowRows.filter((h) => {
        const v = basePerOneTarget(h.rates, chartBase, code);
        return typeof v === 'number' && Number.isFinite(v) && v > 0;
      });
      const dates = okRows.map((r) => r.shanghaiDate);
      const values = okRows.map(
        (r) => basePerOneTarget(r.rates, chartBase, code)!
      );
      const series: FxMultiSeries[] = [
        {
          code,
          color: colorList[i]!,
          values,
        },
      ];
      return { code, dates, series, pointCount: okRows.length };
    });
  }, [monthlyWindowRows, chartBase, theme]);

  useEffect(() => {
    if (fxMonthlySeriesByCode.length === 0) {
      setSelectedFxCode(null);
      return;
    }
    setSelectedFxCode((prev) =>
      prev != null && fxMonthlySeriesByCode.some((c) => c.code === prev)
        ? prev
        : fxMonthlySeriesByCode[0]!.code
    );
  }, [fxMonthlySeriesByCode]);

  const activeFxSeries = useMemo(() => {
    if (fxMonthlySeriesByCode.length === 0) return null;
    const hit =
      selectedFxCode != null
        ? fxMonthlySeriesByCode.find((c) => c.code === selectedFxCode)
        : null;
    return hit ?? fxMonthlySeriesByCode[0]!;
  }, [fxMonthlySeriesByCode, selectedFxCode]);

  /** ScrollView 左右各 20 + 卡片左右各 16 */
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

  const hubStyles = useMemo(() => createSettingsScreenStyles(theme), [theme]);

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
            paddingHorizontal: 20,
          },
        ]}
      >
        <View
          style={[
            hubStyles.mastheadBlock,
            { paddingTop: 16, paddingHorizontal: 4 },
          ]}
        >
          <Text style={hubStyles.masthead}>FX</Text>
          <Text style={hubStyles.kicker}>FRANKFURTER · DISPLAY BASE</Text>
          <Text
            style={{
              fontFamily: AppFont.displayBold,
              fontSize: 26,
              letterSpacing: -0.6,
              lineHeight: 30,
              color: theme.primary,
              marginTop: 6,
            }}
          >
            汇率信息
          </Text>
        </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <>
          <View
            style={{
              borderRadius: 20,
              padding: 16,
              marginBottom: 12,
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
                marginBottom: 8,
              }}
            >
              汇率走势（近一月）
            </Text>
            {fxHistory.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {fxMonthlySeriesByCode.map((card) => {
                    const selected = card.code === selectedFxCode;
                    const lineColor = card.series[0]!.color;
                    return (
                      <Pressable
                        key={card.code}
                        accessibilityLabel={`${FX_CODE_LABEL_ZH[card.code] ?? card.code} 走势`}
                        onPress={() => setSelectedFxCode(card.code)}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          alignItems: 'center',
                          paddingVertical: 4,
                          paddingHorizontal: 2,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: selected
                            ? theme.primary
                            : appearance === 'dark'
                              ? 'rgba(255,255,255,0.12)'
                              : rgbaFromHex(theme.primary, 0.18),
                          backgroundColor: selected
                            ? rgbaFromHex(theme.primary, 0.1)
                            : appearance === 'dark'
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(255,255,255,0.55)',
                        }}
                      >
                        <View
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 3.5,
                            backgroundColor: lineColor,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.75)',
                          }}
                        />
                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight: '800',
                            color: theme.primary,
                            marginTop: 2,
                            letterSpacing: -0.2,
                          }}
                          numberOfLines={1}
                        >
                          {card.code}
                        </Text>
                      </Pressable>
                    );
                })}
              </View>
            ) : null}
            <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
              基准：{FX_CODE_LABEL_ZH[chartBase] ?? chartBase}（{chartBase}）
              {chartBase !== displayCurrency.trim().toUpperCase()
                ? ` · 设置中的默认展示货币为 ${displayCurrency}`
                : ''}
              。主五币对称：默认币在其中时可选其余 4
              种走势；在其外时可选主五币。点图标切换币种，同一时间只显示一条曲线；纵轴为该币相对基准。若个别历史日缺该币种报价，只用有数据的交易日连线。
            </Text>
            {fxHistory.length === 0 ? (
              <Text style={{ fontSize: 14, color: muted }}>
                尚未累积按日历史。打开总览后会自动尝试回填近 30 日序列；亦可下拉同步行情。
              </Text>
            ) : (
              <>
                {activeFxSeries ? (
                  <>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: theme.primary,
                        marginBottom: 4,
                      }}
                    >
                      {FX_CODE_LABEL_ZH[activeFxSeries.code] ?? activeFxSeries.code}{' '}
                      <Text style={{ fontSize: 12, fontWeight: '500', color: muted }}>
                        纵轴：多少 {chartBase} = 1 {activeFxSeries.code}
                      </Text>
                    </Text>
                    {activeFxSeries.pointCount >= 2 &&
                    activeFxSeries.dates.length >= 2 ? (
                      <>
                        <FxMultiTrendChart
                          dates={activeFxSeries.dates}
                          series={activeFxSeries.series}
                          width={chartW}
                          height={chartH}
                          gridStroke={theme.chartGridStroke}
                          axisLabelColor={axisMuted}
                          formatY={(n) =>
                            formatRateOrSmallNumberOneLine(
                              n,
                              activeFxSeries?.code ?? null
                            )
                          }
                        />
                        <Text
                          style={{
                            fontSize: 11,
                            color: muted,
                            marginTop: 6,
                          }}
                        >
                          当前币种有效交易日 {activeFxSeries.pointCount} 天
                        </Text>
                      </>
                    ) : (
                      <Text style={{ fontSize: 14, color: muted }}>
                        「{activeFxSeries.code}
                        」近一月可计算的有效交易日不足 2 天（当前{' '}
                        {activeFxSeries.pointCount}{' '}
                        天）。请联网同步或换选其它图标；旧版历史可能暂缺英镑等字段。
                      </Text>
                    )}
                  </>
                ) : null}
              </>
            )}
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
                暂无当日汇率快照。请在总览下拉同步行情或触发一次净值折算，成功后可显示主五币走势及下方各币种对默认货币的交叉价。
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
                  {showBaseFallbackNote
                    ? ''
                    : ` · 多少 ${tableBase} = 1 单位标价币种`}
                </Text>
                {ASSET_CURRENCY_OPTIONS.filter((o) => o.code !== tableBase).map(
                  (o) => {
                    const cross = basePerOneTarget(
                      fx.rates,
                      tableBase,
                      o.code
                    );
                    const label = o.label;
                    const line =
                      cross != null
                        ? `${label}（${o.code}）: ${formatTableValue(cross, o.code)}`
                        : `${label}（${o.code}）: —`;
                    return (
                      <Text
                        key={o.code}
                        {...numberSingleLineTextProps}
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
                  }
                )}
              </>
            )}
          </View>
        </>
      )}
    </ScrollView>
    </View>
  );
}
