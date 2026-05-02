/**
 * 汇率说明：Frankfurter（ECB 口径）USD 串联存库；展示时按「设置 · 默认货币」为基准换算。
 */

import {
  FxMultiTrendChart,
  type FxMultiSeries,
} from '@/components/fx-multi-trend-chart';
import { SettingsHubBackTopBar } from '@/components/settings-hub-back-navigation';
import { useAppPalette } from '@/contexts/app-palette-context';
import { useLanguage } from '@/contexts/language-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { ASSET_CURRENCY_OPTIONS } from '@/lib/asset-currency';
import { rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  basePerOneTarget,
  effectiveChartBase,
  pickFxMonthlyChartTargets,
} from '@/lib/fx-cross-rate';
import {
  ensureFxUsdRatesHistoryBackfill,
  getFxUsdRatesHistory,
  type FxUsdMidRates,
} from '@/lib/fx-rates';
import { addCalendarDaysYmd } from '@/lib/insights-model';
import type { TranslationKey } from '@/lib/language';
import {
  formatRateOrSmallNumberOneLine,
  numberSingleLineTextProps,
} from '@/lib/numeric-display-one-line';
import { createSettingsScreenStyles } from '@/lib/settings-screen-styles';
import {
  useDisplayCurrency,
  useFxUsdRates,
  useHydrated,
} from '@/lib/store/selectors';
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
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const fx = useFxUsdRates();
  const displayCurrency = useDisplayCurrency();
  /** fxHistory 不在 store（独立 storage key 且仅本页消费），保留本地 useState */
  const [fxHistory, setFxHistory] = useState<FxUsdMidRates[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  /** 单卡内切换：当前展示走势的主五币目标代码 */
  const [selectedFxCode, setSelectedFxCode] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setHistoryLoading(true);
        try {
          try {
            await ensureFxUsdRatesHistoryBackfill();
          } catch {
            /* 回填失败仍展示已有本地历史 */
          }
          const hist = await getFxUsdRatesHistory();
          if (!cancelled) setFxHistory(hist);
        } catch {
          if (!cancelled) setFxHistory([]);
        } finally {
          if (!cancelled) setHistoryLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const loading = !hydrated || historyLoading;

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
  const currencyLabel = useCallback(
    (code: string) => t(`currency.${code}` as TranslationKey),
    [t]
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
            paddingHorizontal: 20,
          },
        ]}
      >
        <View style={hubStyles.mastheadBlockHubNarrow}>
          <Text style={hubStyles.masthead}>{t('masthead.fx')}</Text>
          <Text style={hubStyles.kicker}>{t('masthead.fxKicker')}</Text>
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
              {t('fx.trendTitle')}
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
                        accessibilityLabel={t('fx.trendAccessibility', {
                          currency: currencyLabel(card.code),
                        })}
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
            {fxHistory.length === 0 ? (
              <Text style={{ fontSize: 14, color: muted }}>
                {t('fx.noHistory')}
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
                      {currencyLabel(activeFxSeries.code)}
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
                          {t('fx.validDays', { count: activeFxSeries.pointCount })}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ fontSize: 14, color: muted }}>
                        {t('fx.insufficientDays', {
                          code: activeFxSeries.code,
                          count: activeFxSeries.pointCount,
                        })}
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
              {t('fx.cachedMidTitle')}
            </Text>
            {!fx ? (
              <Text style={{ fontSize: 14, color: muted }}>
                {t('fx.noSnapshot')}
              </Text>
            ) : (
              <>
                {showBaseFallbackNote ? (
                  <Text style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                    {t('fx.baseFallback', { currency: displayCurrency })}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, color: muted, marginBottom: 12 }}>
                  {t('fx.cacheDate', { date: fx.shanghaiDate })}
                </Text>
                {ASSET_CURRENCY_OPTIONS.filter((o) => o.code !== tableBase).map(
                  (o) => {
                    const cross = basePerOneTarget(
                      fx.rates,
                      tableBase,
                      o.code
                    );
                    const label = currencyLabel(o.code);
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
