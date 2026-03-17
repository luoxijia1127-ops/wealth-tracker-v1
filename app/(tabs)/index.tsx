/**
 * DASHBOARD SCREEN (Peek-inspired, minimal)
 *
 * Loads assets from AsyncStorage (key "assets"). Net Worth is the sum of all
 * asset values. Assets are grouped by category (ShortTermInvestment,
 * LongTermInvestment, Cash, Other). Each category shows its percentage and a
 * horizontal progress bar. Dark theme, centered layout, rounded bars.
 *
 * Value per asset: if shares and price exist and > 0, value = shares * price;
 * otherwise use the stored value (e.g. for cash).
 *
 * Comments explain each part for beginner developers.
 */

import type { SimpleAsset } from './add-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ASSETS_STORAGE_KEY = 'assets';

// Categories we group by (must match Add screen)
const CATEGORIES = [
  'ShortTermInvestment',
  'LongTermInvestment',
  'Cash',
  'Other',
] as const;

// Modern colors for each category (Peek-inspired palette)
const CATEGORY_COLORS: Record<string, string> = {
  ShortTermInvestment: '#4ADE80', // green
  LongTermInvestment: '#60A5FA',  // blue
  Cash: '#FACC15',                // yellow
  Other: '#A78BFA',               // purple
};

/**
 * Returns one asset's value. If shares and price exist and > 0, value = shares * price.
 * Otherwise use the stored value (e.g. for cash assets).
 */
function getAssetValue(asset: SimpleAsset): number {
  if (
    typeof asset.shares === 'number' &&
    typeof asset.price === 'number' &&
    asset.shares > 0 &&
    asset.price > 0
  ) {
    return asset.shares * asset.price;
  }
  return typeof asset.value === 'number' ? asset.value : 0;
}

/**
 * Formats a number as US currency (e.g. 1500 -> "$1,500").
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Groups assets by category and sums the value for each.
 * Returns an object: { ShortTermInvestment: 1000, Cash: 500, ... }
 */
function groupByCategory(assets: SimpleAsset[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const cat of CATEGORIES) {
    totals[cat] = 0;
  }
  for (const asset of assets) {
    const cat = asset.category ?? 'Other';
    if (totals[cat] !== undefined) {
      totals[cat] += getAssetValue(asset);
    } else {
      totals['Other'] = (totals['Other'] ?? 0) + getAssetValue(asset);
    }
  }
  return totals;
}

/**
 * Builds allocation data: category name, value, percentage, and color.
 * Percentage = (category value / net worth) * 100. Only includes categories with value > 0.
 */
function buildAllocationData(
  totals: Record<string, number>,
  netWorth: number
): { category: string; value: number; percentage: number; color: string }[] {
  if (netWorth <= 0) return [];
  return CATEGORIES.filter((cat) => totals[cat] > 0).map((cat) => ({
    category: cat,
    value: totals[cat],
    percentage: (totals[cat] / netWorth) * 100,
    color: CATEGORY_COLORS[cat] ?? '#A78BFA',
  }));
}

/**
 * A single category row: name, percentage, and horizontal progress bar.
 * The bar is a rounded track with a colored fill whose width = percentage.
 */
function CategoryBar({
  category,
  percentage,
  color,
}: {
  category: string;
  percentage: number;
  color: string;
}) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryName}>{category}</Text>
        <Text style={styles.categoryPercent}>{percentage.toFixed(1)}%</Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);

  /** Load assets from AsyncStorage. Same key "assets" used by the Add screen. */
  const loadAssets = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(ASSETS_STORAGE_KEY);
      const list: SimpleAsset[] = stored ? JSON.parse(stored) : [];
      setAssets(list);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Reload when the Dashboard tab is focused so data stays up to date. */
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssets();
    }, [loadAssets])
  );

  const netWorth = assets.reduce((sum, a) => sum + getAssetValue(a), 0);
  const categoryTotals = groupByCategory(assets);
  const allocationData = buildAllocationData(categoryTotals, netWorth);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Net Worth at top, large text, centered */}
      <View style={styles.netWorthSection}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthValue}>{formatCurrency(netWorth)}</Text>
      </View>

      {/* Horizontal bar chart: each category with name, percentage, progress bar */}
      <View style={styles.allocationSection}>
        {allocationData.length > 0 ? (
          allocationData.map((item) => (
            <CategoryBar
              key={item.category}
              category={item.category}
              percentage={item.percentage}
              color={item.color}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>Add assets to see allocation</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0D',
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },

  netWorthSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  netWorthLabel: {
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },

  netWorthValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  allocationSection: {
    width: '100%',
    maxWidth: 360,
    gap: 20,
  },

  categoryRow: {
    gap: 8,
  },

  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  categoryName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  categoryPercent: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },

  barFill: {
    height: '100%',
    borderRadius: 4,
  },

  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 32,
  },
});
