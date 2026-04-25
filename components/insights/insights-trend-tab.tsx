/**
 * Insights · 资产变动：区间选择（含自定义起止日）+ 千元纵轴面积图
 */

import { InsightsNetWorthAreaChart } from '@/components/insights/insights-networth-area-chart';
import { TradingDateCalendarModal } from '@/components/trading-date-calendar-modal';
import {
  formatYmdChineseLine,
  YmdDateFields,
} from '@/components/ymd-date-fields';
import { useAppPalette } from '@/contexts/app-palette-context';
import type { AppPaletteTheme } from '@/lib/app-palette';
import { formatMoney } from '@/lib/asset-value';
import { pickTextOnAccent, rgbaFromHex } from '@/lib/color-utils';
import { getShanghaiDateString } from '@/lib/date-shanghai';
import {
  addCalendarDaysYmd,
  snapshotDisplayTotalInDisplay,
  TREND_TIMEFRAME_OPTIONS,
  type TrendChartModel,
  type TrendCustomRange,
  type TrendTimeframe,
} from '@/lib/insights-model';
import type { InsightsStyles } from '@/lib/insights-styles';
import { createAddModalStyles } from '@/lib/modal-styles';
import type { FxUsdMidRates } from '@/lib/fx-rates';
import type { Snapshot } from '@/lib/snapshots';
import { Ionicons } from '@expo/vector-icons';
import {
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarWhich, setCalendarWhich] = useState<'start' | 'end' | null>(
    null
  );
  /** 避免「自定义区间 Modal」与日历 Modal 叠两层导致日历无法弹出；从日历返回时再打开自定义层 */
  const resumeCustomAfterCalendarRef = useRef(false);

  const addModalStyles = useMemo(
    () => createAddModalStyles(theme),
    [theme]
  );
  const webDatePlaceholderColor = useMemo(
    () => rgbaFromHex(theme.primary, 0.42),
    [theme.primary]
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

  const closeCustomSheet = useCallback(() => {
    resumeCustomAfterCalendarRef.current = false;
    setCustomModalOpen(false);
    setCalendarOpen(false);
    setCalendarWhich(null);
  }, []);

  const openCalendarFor = useCallback((which: 'start' | 'end') => {
    resumeCustomAfterCalendarRef.current = true;
    setCalendarWhich(which);
    setCustomModalOpen(false);
    InteractionManager.runAfterInteractions(() => {
      setCalendarOpen(true);
    });
  }, []);

  const confirmCustomRange = useCallback(() => {
    let s = draftStart.trim();
    let e = draftEnd.trim();
    if (s > e) {
      const t = s;
      s = e;
      e = t;
    }
    onCustomRangeChange({ start: s, end: e });
    closeCustomSheet();
  }, [draftStart, draftEnd, onCustomRangeChange, closeCustomSheet]);

  const calendarMinDate = useMemo(() => {
    if (calendarWhich !== 'end') return '1990-01-01';
    const s = draftStart.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '1990-01-01';
  }, [calendarWhich, draftStart]);

  const calendarMaxDate = useMemo(() => {
    const today = getShanghaiDateString();
    if (calendarWhich !== 'start') return today;
    const e = draftEnd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return today;
    return e <= today ? e : today;
  }, [calendarWhich, draftEnd]);

  const calendarValue = useMemo(() => {
    const today = getShanghaiDateString();
    if (calendarWhich === 'end') {
      const e = draftEnd.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(e) ? e : today;
    }
    const s = draftStart.trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : today;
  }, [calendarWhich, draftStart, draftEnd]);

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
      <View
        style={[
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            paddingHorizontal: 24,
            paddingTop: 4,
            paddingBottom: 6,
          },
        ]}
      >
        {TREND_TIMEFRAME_OPTIONS.map((opt) => {
          const active = timeframe === opt.id;
          const accent = theme.primary;
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
                styles.returnChipInRow,
                active
                  ? {
                      backgroundColor: accent,
                      borderWidth: 0,
                    }
                  : {
                      backgroundColor: rgbaFromHex(accent, 0.08),
                      borderWidth: 1,
                      borderColor: rgbaFromHex(accent, 0.2),
                    },
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  styles.returnChipTextInRow,
                  {
                    color: active ? pickTextOnAccent(accent) : textSecondary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
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
              {
                zIndex: 0,
                backgroundColor: 'rgba(0,0,0,0.45)',
              },
            ]}
            onPress={closeCustomSheet}
          />
          <View
            style={{
              flex: 1,
              justifyContent: Platform.OS === 'ios' ? 'flex-end' : 'center',
              paddingHorizontal: Platform.OS === 'android' ? 24 : 0,
              pointerEvents: 'box-none',
              zIndex: 1,
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
            {Platform.OS === 'web' ? (
              <View style={{ paddingHorizontal: 20, gap: 14 }}>
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      marginBottom: 8,
                      color: textMuted,
                    }}
                  >
                    开始日期
                  </Text>
                  <YmdDateFields
                    value={draftStart}
                    onChangeText={setDraftStart}
                    placeholderColor={webDatePlaceholderColor}
                    inputStyle={addModalStyles.input}
                    labelColor={rgbaFromHex(theme.primary, 0.62)}
                  />
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      marginBottom: 8,
                      color: textMuted,
                    }}
                  >
                    结束日期
                  </Text>
                  <YmdDateFields
                    value={draftEnd}
                    onChangeText={setDraftEnd}
                    placeholderColor={webDatePlaceholderColor}
                    inputStyle={addModalStyles.input}
                    labelColor={rgbaFromHex(theme.primary, 0.62)}
                  />
                </View>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 20, gap: 4 }}>
                <Pressable
                  onPress={() => openCalendarFor('start')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(0,0,0,0.08)',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="选择开始日期"
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>
                      开始日期
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        marginTop: 4,
                      }}
                    >
                      {formatYmdChineseLine(draftStart)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={textMuted}
                  />
                </Pressable>
                <Pressable
                  onPress={() => openCalendarFor('end')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(0,0,0,0.08)',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="选择结束日期"
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 12, color: textMuted }}>
                      结束日期
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: '600',
                        marginTop: 4,
                      }}
                    >
                      {formatYmdChineseLine(draftEnd)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={textMuted}
                  />
                </Pressable>
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
                paddingTop: 14,
              }}
            >
              <Pressable onPress={closeCustomSheet}>
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
            </View>
          </View>
        </View>
      </Modal>

      {Platform.OS !== 'web' ? (
        <TradingDateCalendarModal
          visible={calendarOpen}
          onClose={() => {
            setCalendarOpen(false);
            setCalendarWhich(null);
            if (resumeCustomAfterCalendarRef.current) {
              resumeCustomAfterCalendarRef.current = false;
              setCustomModalOpen(true);
            }
          }}
          value={calendarValue}
          onSelect={(ymd) => {
            if (calendarWhich === 'start') setDraftStart(ymd);
            else if (calendarWhich === 'end') setDraftEnd(ymd);
          }}
          themePrimary={theme.primary}
          maxDate={calendarMaxDate}
          minDate={calendarMinDate}
        />
      ) : null}
    </>
  );
}
