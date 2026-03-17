/**
 * PORTFOLIO SCREEN
 *
 * Loads assets from AsyncStorage (key "assets") and displays them grouped by:
 * 1. Category (ShortTermInvestment, LongTermInvestment, Cash, Other)
 * 2. Type (Stock, ETF, Fund, Deposit, Gold)
 *
 * Display structure (collapsible):
 *   Category (large, tap to expand/collapse) ▼ or ▶
 *     Type (indented, tap to expand/collapse) ▼ or ▶
 *       Asset list (Name, Total Value)
 *
 * useState tracks which categories and types are expanded. Default: all expanded.
 * Arrow: ▼ = expanded, ▶ = collapsed.
 *
 * Design: Peek-inspired dark UI. Each category in a card (#15161A). Text hierarchy:
 * Category (large, bold, white), Type (smaller, grey), Asset (normal white).
 * Divider lines (#23242A) separate types. Clean minimal layout.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SimpleAsset } from './add-asset';

const ASSETS_STORAGE_KEY = 'assets';

// Category and type order for consistent grouping (matches Add screen options)
const CATEGORY_ORDER = [
  'ShortTermInvestment',
  'LongTermInvestment',
  'Cash',
  'Other',
] as const;

const TYPE_ORDER = ['Stock', 'ETF', 'Fund', 'Deposit', 'Gold'] as const;

/**
 * Formats a number as US currency (e.g. 1500 -> "$1,500").
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Returns the total value for an asset.
 * If shares and price exist and both > 0: total = shares * price.
 * Otherwise: use the stored value (e.g. for Cash assets).
 */
function getTotalValue(item: SimpleAsset): number {
  if (
    typeof item.shares === 'number' &&
    typeof item.price === 'number' &&
    item.shares > 0 &&
    item.price > 0
  ) {
    return item.shares * item.price;
  }
  return typeof item.value === 'number' ? item.value : 0;
}

/**
 * Groups assets by Category, then by Type.
 * Returns: { [category]: { [type]: SimpleAsset[] } }
 * Only includes categories and types that have assets.
 */
function groupByCategoryAndType(assets: SimpleAsset[]): Record<string, Record<string, SimpleAsset[]>> {
  const grouped: Record<string, Record<string, SimpleAsset[]>> = {};

  for (const asset of assets) {
    const cat = asset.category ?? 'Other';
    const type = asset.type ?? 'Other';

    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][type]) grouped[cat][type] = [];
    grouped[cat][type].push(asset);
  }

  return grouped;
}

/**
 * A single asset row: Name on the left, Total Value on the right.
 * Indented to show it belongs under a Type.
 */
function AssetRow({ name, value }: { name: string; value: number }) {
  return (
    <View style={styles.assetRow}>
      <Text style={styles.assetName}>{name}</Text>
      <Text style={styles.assetValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Track which categories and types are expanded. Set<string> for O(1) lookup.
   * Category: key is category name. Type: key is "category|type" for uniqueness.
   * Default: all expanded (set in useEffect when we first get data).
   */
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  /** Toggle a category's expanded state when the user taps it. */
  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  /** Toggle a type's expanded state. Key format: "category|type". */
  const toggleType = useCallback((cat: string, type: string) => {
    const key = `${cat}|${type}`;
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /**
   * Loads assets from AsyncStorage. Uses key "assets" (same as Add screen).
   * getItem returns null if never set, so we default to []. Catch parse errors.
   */
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

  /** Reload when this screen is focused (e.g. after adding an asset). */
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssets();
    }, [loadAssets])
  );

  const grouped = useMemo(
    () => groupByCategoryAndType(assets),
    [assets]
  );

  /**
   * Initialize expanded state when we first get data.
   * Default: all expanded. Only run when we have categories and sets are empty,
   * so we don't overwrite user's collapse choices on every re-render.
   */
  useEffect(() => {
    const categories = Object.keys(grouped);
    if (categories.length === 0) return;
    setExpandedCategories((prev) => {
      if (prev.size > 0) return prev;
      return new Set(categories);
    });
    setExpandedTypes((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const [cat, typeMap] of Object.entries(grouped)) {
        for (const type of Object.keys(typeMap)) {
          if (typeMap[type].length > 0) next.add(`${cat}|${type}`);
        }
      }
      return next;
    });
  }, [grouped]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Portfolio</Text>
      <Text style={styles.subtitle}>
        {assets.length === 0
          ? 'No assets yet. Add one from the Add tab.'
          : `${assets.length} asset${assets.length === 1 ? '' : 's'}`}
      </Text>

      {assets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No assets</Text>
        </View>
      ) : (
        <View style={styles.groupsContainer}>
          {/* Iterate in fixed order so categories appear consistently */}
          {CATEGORY_ORDER.map((category) => {
            const typesMap = grouped[category];
            if (!typesMap) return null;

            const typeEntries = TYPE_ORDER.filter((t) => typesMap[t]?.length > 0);
            if (typeEntries.length === 0) return null;

            const isCategoryExpanded = expandedCategories.has(category);

            // Sum total value for this category (all assets across all types)
            const categoryTotal = typeEntries.reduce(
              (sum, type) =>
                sum +
                typesMap[type].reduce((s, a) => s + getTotalValue(a), 0),
              0
            );

            return (
              <View key={category} style={styles.categorySection}>
                {/* Category: Pressable with arrow + title on left, total value on right */}
                <Pressable
                  style={styles.categoryHeader}
                  onPress={() => toggleCategory(category)}
                >
                  <View style={styles.categoryHeaderLeft}>
                    <Text style={styles.categoryArrow}>
                      {isCategoryExpanded ? '▼' : '▶'}
                    </Text>
                    <Text style={styles.categoryTitle}>{category}</Text>
                  </View>
                  <Text style={styles.categoryTotal}>
                    {formatCurrency(categoryTotal)}
                  </Text>
                </Pressable>

                {/* Subtle divider between category header and types (when expanded) */}
                {isCategoryExpanded && typeEntries.length > 0 && (
                  <View style={styles.divider} />
                )}

                {/* Only show types when category is expanded */}
                {isCategoryExpanded &&
                  typeEntries.map((type, typeIndex) => {
                    const typeKey = `${category}|${type}`;
                    const isTypeExpanded = expandedTypes.has(typeKey);

                    return (
                      <View key={type}>
                        {typeIndex > 0 && <View style={styles.divider} />}
                        <View style={styles.typeSection}>
                          <Pressable
                            style={styles.typeHeader}
                            onPress={() => toggleType(category, type)}
                          >
                            <Text style={styles.typeArrow}>
                              {isTypeExpanded ? '▼' : '▶'}
                            </Text>
                            <Text style={styles.typeTitle}>{type}</Text>
                          </Pressable>

                          {/* Only show assets when type is expanded */}
                          {isTypeExpanded &&
                            typesMap[type].map((asset) => (
                              <AssetRow
                                key={asset.id}
                                name={asset.name}
                                value={getTotalValue(asset)}
                              />
                            ))}
                        </View>
                      </View>
                    );
                  })}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * STYLES — Peek-inspired dark UI
 *
 * Design tokens:
 * - Background: deep dark (#0B0B0F) for contrast
 * - Cards: elevated surface (#15161A), rounded, padded
 * - Category: large, bold, white (#E5E7EB)
 * - Type: smaller, grey (#9CA3AF)
 * - Asset: normal white
 * - Dividers: subtle (#23242A)
 */
const styles = StyleSheet.create({
  // Main screen background — deep dark for modern fintech look
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },

  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingHorizontal: 24,
    gap: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E5E7EB',
  },

  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 4,
  },

  groupsContainer: {
    gap: 20, // Space between category cards
  },

  // Category card: each category lives in its own card
  // Background elevates it from the screen; rounded corners + padding for clean minimal look
  categorySection: {
    backgroundColor: '#15161A',
    borderRadius: 16,
    padding: 20,
  },
  // Category header: pressable row — left: arrow + title; right: category total value
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
  },
  categoryArrow: {
    fontSize: 14,
    color: '#8E8E93',
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  // Type header: pressable row with arrow + title, indented
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  typeArrow: {
    fontSize: 12,
    color: '#8E8E93',
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  // Divider: subtle horizontal line (#23242A) between category header and types
  divider: {
    height: 1,
    backgroundColor: '#23242A',
    marginVertical: 4,
  },
  // Type section: indented under category
  typeSection: {
    marginLeft: 16,
    gap: 10,
  },
  // Asset row: further indented, name left / value right
  assetRow: {
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  assetName: {
    fontSize: 16,
    color: '#E5E7EB',
    fontWeight: '500',
  },
  assetValue: {
    fontSize: 16,
    color: '#34C759',
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: '#15161A',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyText: {
    fontSize: 17,
    color: '#8E8E93',
  },
});
