/**
 * Insights · 资产变动：区间选择（含自定义起止日）+ 千元纵轴面积图
 */

import { InsightsNetWorthAreaChart } from '@/components/insights/insights-networth-area-chart';
import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { formatMoney } from '@/lib/asset-value';
import { rgbaFromHex } from '@/lib/color-utils';
import {
  addCalendarDaysYmd,
  snapshotDisplayTotalInDisplay,
  TREND_TIMEFRAME_OPTIONS,
  type TrendChartModel,
  type TrendCustomRange,
  type TrendTimeframe,
} from '@/lib/insights-model';
import type { InsightsStyles } from '@/lib/insights-styles';
import {
  formatInstantToShanghaiDateString,
  getShanghaiDateString,
  shanghaiYmdToLocalNoon,
} from '@/lib/date-shanghai';
import type { FxUsdMidRates } from '@/lib/fx-rates';
import type { Snapshot } from '@/lib/snapshots';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function InsightsTrendChart({
  trendModel,
  chartWidth,
  chartHeight,
  styles,
  textSecondary,
  textMuted,
  orderedSnapshots,
  trendTip,
  theme,
  timeframe,
  onTimeframeChange,
  customRange,
  onCustomRangeChange,
  hasChartData,
  emptyHint,
  emptyHintColor,
  onDataPointClick,
  displayCurrency = 'CNY',
  usdRatesForTooltip,
}: {
  trendModel: TrendChartModel;
  chartWidth: number;
  chartHeight: number;
  styles: InsightsStyles;
  textSecondary: string;
  textMuted: string;
  orderedSnapshots: Snapshot[];
  trendTip: { index: number; x: number; y: number } | null;
  theme: AppPaletteTheme;
  timeframe: TrendTimeframe;
  onTimeframeChange: (t: TrendTimeframe) => void;
  customRange: TrendCustomRange | null;
  onCustomRangeChange: (r: TrendCustomRange) => void;
  hasChartData: boolean;
  emptyHint: string;
  emptyHintColor: string;
  onDataPointClick: (p: { index: number; x: number; y: number }) => void;
  displayCurrency?: string;
  usdRatesForTooltip?: FxUsdMidRates['rates'] | null;
}) {
  const insets = useSafeAreaInsets();
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [iosWhich, setIosWhich] = useState<'start' | 'end' | null>(null);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [androidWhich, setAndroidWhich] = useState<'start' | 'end' | null>(
    null
  );

  const openCustomModal = useCallback(() => {
    const anchor = getShanghaiDateString();
    const start =
      customRange?.start ?? addCalendarDaysYmd(anchor, -30);
    const end = customRange?.end ?? anchor;
    setDraftStart(start);
    setDraftEnd(end);
    setCustomModalOpen(true);
  }, [customRange]);

  const confirmCustomRange = useCallback(() => {
    let s = draftStart.trim();
    let e = draftEnd.trim();
    if (s > e) {
      const t = s;
      s = e;
      e = t;
    }
    onCustomRangeChange({ start: s, end: e });
    setCustomModalOpen(false);
  }, [draftStart, draftEnd, onCustomRangeChange]);

  const showPicker = (which: 'start' | 'end') => {
    if (Platform.OS === 'android') {
      setAndroidWhich(which);
      setAndroidOpen(true);
    } else {
      setIosWhich(which);
    }
  };

  const onAndroidDateChange = (_: unknown, date?: Date) => {
    setAndroidOpen(false);
    if (!date || !androidWhich) return;
    const ymd = formatInstantToShanghaiDateString(date);
    if (androidWhich === 'start') setDraftStart(ymd);
    else setDraftEnd(ymd);
    setAndroidWhich(null);
  };

  const pickerValue =
    iosWhich === 'start'
      ? draftStart
      : iosWhich === 'end'
        ? draftEnd
        : draftStart;

  const { appearance } = useAppPalette();
  const trendAxisLabelColor = useMemo(
    () =>
      appearance === 'dark'
        ? 'rgba(255,255,255,0.42)'
        : rgbaFromHex(theme.primary, 0.38),
    [appearance, theme.primary]
  );
  const trendLineStrokeWidth = appearance === 'dark' ? 3 : 2.25;

  return (
    <>
      <View style={styles.timeframeRow}>
        {TREND_TIMEFRAME_OPTIONS.map((opt) => {
          const active = timeframe === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (opt.id === 'CUSTOM') {
                  onTimeframeChange('CUSTOM');
                  openCustomModal();
                } else {
                  onTimeframeChange(opt.id);
                }
              }}
              style={({ pressed }) => [
                styles.timeframeChip,
                active && styles.timeframeChipActiveDark,
                pressed && !active && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  styles.timeframeChipText,
                  active && styles.timeframeChipTextActiveDark,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!hasChartData ? (
        <View
          style={[styles.chartPlaceholder, { minHeight: chartHeight * 0.65 }]}
        >
          <Text style={[styles.placeholderText, { color: emptyHintColor }]}>
            {emptyHint}
          </Text>
        </View>
      ) : (
        <View style={styles.trendChartWrap}>
          <InsightsNetWorthAreaChart
            series={trendModel.series}
            width={chartWidth}
            height={chartHeight}
            yMin={trendModel.yMin}
            yMax={trendModel.yMax}
            lineColor={theme.chartLine}
            fillTop={theme.chartFillTop}
            fillBottom={theme.chartFillBottom}
            gridStroke={theme.chartGridStroke}
            axisLabelColor={trendAxisLabelColor}
            axisLabelOpacity={0.66}
            displayCurrency={displayCurrency}
            lineStrokeWidth={trendLineStrokeWidth}
            ghostAreaFill={appearance === 'dark'}
            onPointPress={({ index, x, y }) => {
              onDataPointClick({ index, x, y });
            }}
          />
          {trendTip &&
          trendTip.index >= 0 &&
          trendTip.index < orderedSnapshots.length ? (
            <View
              style={[
                styles.trendTooltip,
                {
                  left: Math.max(
                    8,
                    Math.min(chartWidth - 180, trendTip.x - 74)
                  ),
                  top: Math.max(8, trendTip.y - 58),
                },
              ]}
            >
              <Text style={styles.trendTooltipDate}>
                {orderedSnapshots[trendTip.index]!.date}
              </Text>
              <Text style={styles.trendTooltipValue}>
                {formatMoney(
                  snapshotDisplayTotalInDisplay(
                    orderedSnapshots[trendTip.index]!,
                    displayCurrency,
                    usdRatesForTooltip ?? null
                  ),
                  displayCurrency
                )}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Modal transparent animationType="fade" visible={customModalOpen}>
        <View style={{ flex: 1 }}>
          <Pressable
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(0,0,0,0.45)' },
            ]}
            onPress={() => setCustomModalOpen(false)}
          />
          <View
            style={{
              flex: 1,
              justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
              paddingHorizontal: Platform.OS === 'android' ? 24 : 0,
              pointerEvents: 'box-none',
            }}
          >
            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderRadius: Platform.OS === 'android' ? 16 : 0,
                paddingBottom: Platform.OS === 'ios' ? insets.bottom + 12 : 20,
                paddingHorizontal: Platform.OS === 'android' ? 20 : 0,
                paddingTop: Platform.OS === 'android' ? 20 : 0,
              }}
            >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                paddingHorizontal: 20,
                paddingTop: Platform.OS === 'ios' ? 16 : 0,
                paddingBottom: 8,
                color: theme.primary,
              }}
            >
              自定义区间
            </Text>
            <View style={{ paddingHorizontal: 20, gap: 4 }}>
              <Pressable
                onPress={() => showPicker('start')}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.08)',
                }}
              >
                <Text style={{ fontSize: 12, color: textMuted }}>开始日期</Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '600', marginTop: 4 }}
                >
                  {draftStart}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => showPicker('end')}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(0,0,0,0.08)',
                }}
              >
                <Text style={{ fontSize: 12, color: textMuted }}>结束日期</Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '600', marginTop: 4 }}
                >
                  {draftEnd}
                </Text>
              </Pressable>
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 14,
              }}
            >
              <Pressable onPress={() => setCustomModalOpen(false)}>
                <Text style={{ fontSize: 16, color: textSecondary }}>取消</Text>
              </Pressable>
              <Pressable onPress={confirmCustomRange}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: theme.primary,
                  }}
                >
                  确定
                </Text>
              </Pressable>
            </View>
            {Platform.OS === 'ios' && iosWhich ? (
              <DateTimePicker
                value={shanghaiYmdToLocalNoon(pickerValue)}
                mode="date"
                display="spinner"
                themeVariant="light"
                onChange={(_, d) => {
                  if (d) {
                    const ymd = formatInstantToShanghaiDateString(d);
                    if (iosWhich === 'start') setDraftStart(ymd);
                    else setDraftEnd(ymd);
                  }
                  setIosWhich(null);
                }}
              />
            ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'android' && androidOpen && androidWhich ? (
        <DateTimePicker
          value={shanghaiYmdToLocalNoon(
            androidWhich === 'start' ? draftStart : draftEnd
          )}
          mode="date"
          display="default"
          onChange={onAndroidDateChange}
        />
      ) : null}
    </>
  );
}
