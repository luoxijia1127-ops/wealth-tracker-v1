/**
 * Insights · 资产变动折线图
 */

import { formatMoney } from '@/lib/asset-value';
import type { InsightsStyles } from '@/lib/insights-styles';
import { snapshotDisplayTotal, type Snapshot } from '@/lib/snapshots';
import { Text, View } from 'react-native';
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
  onDataPointClick: (p: { index: number; x: number; y: number }) => void;
}) {
  return (
    <>
      <View style={styles.inlineLegendRow}>
        <View
          style={[
            styles.legendDot,
            { backgroundColor: theme.chartLine },
          ]}
        />
        <Text style={[styles.legendLabel, { color: textSecondary }]}>
          净值走势
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
          yLabelsOffset={24}
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
  );
}
