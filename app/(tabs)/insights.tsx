/**
 * INSIGHTS SCREEN
 *
 * Loads snapshots from AsyncStorage on mount, transforms to chart format,
 * and renders a LineChart. Handles empty and loading states.
 */

import { getSnapshots } from '@/lib/snapshots';
import type { Snapshot } from '@/lib/snapshots';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

/** Chart data format for react-native-chart-kit LineChart */
type ChartData = {
  labels: string[];
  datasets: [{ data: number[] }];
};

/** Formats a value as US currency. */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats daily change as "+1200 (+2.3%)" or "-500 (-1.2%)". */
function formatChange(diff: number, pct: number): string {
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${Math.round(diff).toLocaleString()} (${sign}${pct.toFixed(1)}%)`;
}

/** Transforms snapshots to chart format. Date YYYY-MM-DD -> label "MM-DD". */
function toChartData(snapshots: Snapshot[]): ChartData {
  return {
    labels: snapshots.map((s) => s.date.slice(5)),
    datasets: [{ data: snapshots.map((s) => s.totalValue) }],
  };
}

/** Computes daily change: { diff, pct } or null if < 2 snapshots. */
function getDailyChange(snapshots: Snapshot[]): { diff: number; pct: number } | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const prev = sorted[sorted.length - 2];
  const last = sorted[sorted.length - 1];
  const diff = last.totalValue - prev.totalValue;
  const pct = prev.totalValue !== 0 ? (diff / prev.totalValue) * 100 : 0;
  return { diff, pct };
}

const CHART_WIDTH = Dimensions.get('window').width - 48 - 56;
const CHART_HEIGHT = 240;

/**
 * Chart config: premium finance dark theme.
 * Pure dark background (no gradient), white line, subtle axis labels.
 */
const chartConfig = {
  backgroundColor: '#15161A',
  backgroundGradientFrom: '#15161A',
  backgroundGradientTo: '#15161A',
  backgroundGradientFromOpacity: 1,
  backgroundGradientToOpacity: 1,
  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
  labelColor: () => 'rgba(148, 163, 184, 0.7)',
  strokeWidth: 2.5,
  decimalPlaces: 0,
  propsForBackgroundLines: {
    stroke: 'rgba(71, 85, 105, 0.35)',
    strokeWidth: 1,
  },
};

export default function Insights() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSnapshots = useCallback(async () => {
    try {
      const data = await getSnapshots();
      setSnapshots(data);
    } catch {
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const chartData = toChartData(snapshots);
  const hasData = chartData.labels.length > 0 && chartData.datasets[0].data.length > 0;

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const dailyChange = getDailyChange(snapshots);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Net Worth</Text>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#34C759" />
              <Text style={styles.hint}>Loading chart...</Text>
            </View>
          ) : !hasData ? (
            <Text style={styles.emptyText}>
              No data yet. Visit the Dashboard to record your first snapshot.
            </Text>
          ) : (
            <>
              <View style={styles.summary}>
                <Text style={styles.currentValue}>
                  {latest ? formatCurrency(latest.totalValue) : ''}
                </Text>
                {dailyChange && (
                  <Text
                    style={[
                      styles.changeText,
                      dailyChange.diff > 0 && { color: '#34C759' },
                      dailyChange.diff < 0 && { color: '#EF4444' },
                      dailyChange.diff === 0 && { color: '#9CA3AF' },
                    ]}
                  >
                    {formatChange(dailyChange.diff, dailyChange.pct)}
                  </Text>
                )}
              </View>
              <View style={styles.chartWrapper}>
                <LineChart
                  data={chartData}
                  width={CHART_WIDTH}
                  height={CHART_HEIGHT}
                  chartConfig={chartConfig}
                  bezier
                  withInnerLines={true}
                  withOuterLines={false}
                  style={styles.chart}
                />
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#15161A',
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  hint: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
    lineHeight: 22,
  },
  summary: {
    marginBottom: 16,
  },
  currentValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#E5E7EB',
    marginBottom: 4,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  chartWrapper: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 16,
    marginVertical: 0,
    paddingRight: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  date: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34C759',
  },
});
