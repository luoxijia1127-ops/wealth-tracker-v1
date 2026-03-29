/**
 * Insights · 资产变动折线图（时间范围 + Y 轴人民币刻度）
 */

import { formatMoney } from '@/lib/asset-value';
import {
  TREND_TIMEFRAME_OPTIONS,
  type TrendTimeframe,
} from '@/lib/insights-model';
import type { InsightsStyles } from '@/lib/insights-styles';
import { snapshotDisplayTotal, type Snapshot } from '@/lib/snapshots';
import { Pressable, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

type ChartData = {
  labels: string[];
  datasets: [{ data: number[] }];
};

export function InsightsTrendChart({
  chartData,
  chartWidth,
  chartHeight,
  chartConfig,
  trendModel,
  styles,
  textSecondary,
  orderedSnapshots,
  trendTip,
  theme,
  timeframe,
  onTimeframeChange,
  hasChartData,
  emptyHint,
  emptyHintColor,
  onDataPointClick,
}: {
  chartData: ChartData;
  chartWidth: number;
  chartHeight: number;
  chartConfig: Record<string, unknown>;
  trendModel: { formatYLabel: (v: string) => string };
  styles: InsightsStyles;
  textSecondary: string;
  orderedSnapshots: Snapshot[];
  trendTip: { index: number; x: number; y: number } | null;
  theme: { chartLine: string; primary: string };
  timeframe: TrendTimeframe;
  onTimeframeChange: (t: TrendTimeframe) => void;
  hasChartData: boolean;
  emptyHint: string;
  emptyHintColor: string;
  onDataPointClick: (p: { index: number; x: number; y: number }) => void;
}) {
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
              onPress={() => onTimeframeChange(opt.id)}
              style={({ pressed }) => [
                styles.timeframeChip,
                active && styles.timeframeChipActive,
                pressed && !active && { opacity: 0.88 },
              ]}
            >
              <Text
                style={[
                  styles.timeframeChipText,
                  active && styles.timeframeChipTextActive,
                ]}
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
        <>
          <View style={styles.inlineLegendRow}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.chartLine },
              ]}
            />
            <Text style={[styles.legendLabel, { color: textSecondary }]}>
              净值走势（CNY）
            </Text>
          </View>
          <View style={styles.trendChartWrap}>
            <LineChart
              data={chartData}
              width={chartWidth}
              height={chartHeight}
              chartConfig={chartConfig as never}
              formatYLabel={trendModel.formatYLabel}
              bezier
              withShadow
              withDots
              withInnerLines
              withOuterLines={false}
              withVerticalLabels
              withVerticalLines={false}
              withHorizontalLabels
              withHorizontalLines
              yLabelsOffset={32}
              xLabelsOffset={4}
              segments={4}
              style={styles.chart}
              fromZero={false}
              onDataPointClick={onDataPointClick}
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
                    snapshotDisplayTotal(orderedSnapshots[trendTip.index]!),
                    'CNY'
                  )}
                </Text>
              </View>
            ) : null}
          </View>
        </>
      )}
    </>
  );
}
