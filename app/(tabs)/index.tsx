/**
 * DASHBOARD SCREEN
 *
 * Merged view: Net Worth at top, then grouped asset structure (Category → Type → Assets).
 * Loads assets from AsyncStorage (key "assets"). Net Worth = sum of all asset values.
 *
 * Structure:
 * 1. Net Worth (large, centered)
 * 2. Grouped assets: Category (collapsible) → Type (collapsible) → Asset list (Name, Total Value)
 *
 * Value per asset: if shares and price exist and > 0, value = shares * price;
 * otherwise use the stored value (e.g. for cash).
 *
 * Dark UI, collapsible sections, spacing. Comments explain each part for beginners.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
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
import type { SimpleAsset } from '@/types/asset';

const ASSETS_STORAGE_KEY = 'assets';

// Category and type order (matches Add screen)
const CATEGORY_ORDER = [
  'ShortTermInvestment',
  'LongTermInvestment',
  'Cash',
  'Other',
] as const;

const TYPE_ORDER = ['Stock', 'ETF', 'Fund', 'Deposit', 'Gold'] as const;

/**
 * Returns one asset's value. If shares and price exist and > 0: value = shares * price.
 * Otherwise: use the stored value (e.g. for cash assets).
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
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Groups assets by Category, then by Type.
 * Returns: { [category]: { [type]: SimpleAsset[] } }
 */
function groupByCategoryAndType(
  assets: SimpleAsset[]
): Record<string, Record<string, SimpleAsset[]>> {
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
 * Single asset row: Name on left, Total Value on right. Indented under a Type.
 */
function AssetRow({ name, value }: { name: string; value: number }) {
  return (
    <View style={styles.assetRow}>
      <Text style={styles.assetName}>{name}</Text>
      <Text style={styles.assetValue}>{formatCurrency(value)}</Text>
    </View>
  );
}

/**
 * Top navigation bar: "Dashboard" title on left, "+" button on right.
 *
 * LAYOUT STRUCTURE:
 *   [flexDirection: row, justifyContent: space-between]
 *   — Left: Title "Dashboard" (bold, white)
 *   — Right: "+" button (minimal, touchable)
 *
 * NAVIGATION:
 *   Expo Router uses file-based routing. The route /modal maps to app/modal.tsx
 *   (a Stack screen with presentation: 'modal'). router.push('/modal') pushes
 *   that screen onto the stack, showing it as a modal overlay for adding assets.
 */
function DashboardHeader({
  insets,
}: {
  insets: { top: number; right: number; left: number };
}) {
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.headerTitle}>Dashboard</Text>
      <Pressable
        style={styles.headerAddButton}
        onPress={() => router.push('/modal')}
      >
        <Text style={styles.headerAddText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);

  /** Track expanded state for collapsible Category and Type sections. */
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleType = useCallback((cat: string, type: string) => {
    const key = `${cat}|${type}`;
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

  /** Initialize expanded state when we first get data. Default: all expanded. */
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

  const netWorth = assets.reduce((sum, a) => sum + getAssetValue(a), 0);

  if (loading) {
    return (
      <View style={styles.screenWrapper}>
        <DashboardHeader insets={insets} />
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color="#4ADE80" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenWrapper}>
      <DashboardHeader insets={insets} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* 1. Net Worth — large, centered (below header) */}
      <View style={styles.netWorthSection}>
        <Text style={styles.netWorthLabel}>Net Worth</Text>
        <Text style={styles.netWorthValue}>{formatCurrency(netWorth)}</Text>
      </View>

      {/* 2. Spacing between Net Worth and asset structure */}
      <View style={styles.spacer} />

      {/* 3. Grouped asset structure: Category → Type → Assets (collapsible) */}
      <View style={styles.assetStructureSection}>
        {assets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Add assets from the Add tab</Text>
          </View>
        ) : (
          <View style={styles.groupsContainer}>
            {CATEGORY_ORDER.map((category) => {
              const typesMap = grouped[category];
              if (!typesMap) return null;

              const typeEntries = TYPE_ORDER.filter((t) => typesMap[t]?.length > 0);
              if (typeEntries.length === 0) return null;

              const isCategoryExpanded = expandedCategories.has(category);
              const categoryTotal = typeEntries.reduce(
                (sum, type) =>
                  sum +
                  typesMap[type].reduce((s, a) => s + getAssetValue(a), 0),
                0
              );

              return (
                <View key={category} style={styles.categoryCard}>
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

                  {isCategoryExpanded && typeEntries.length > 0 && (
                    <View style={styles.divider} />
                  )}

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

                            {isTypeExpanded &&
                              typesMap[type].map((asset) => (
                                <AssetRow
                                  key={asset.id}
                                  name={asset.name}
                                  value={getAssetValue(asset)}
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
      </View>
    </ScrollView>
    </View>
  );
}

/**
 * STYLES — Dark UI, Net Worth + grouped asset structure
 *
 * Design tokens:
 * - Background: #0B0B0F
 * - Cards: #15161A (category cards)
 * - Category text: #E5E7EB (large, bold)
 * - Type text: #9CA3AF (grey)
 * - Asset text: #E5E7EB
 * - Divider: #23242A
 */
const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  // Header bar: title left, + button right. Safe area padding applied inline.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#0B0B0F',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  headerAddButton: {
    padding: 8,
    minWidth: 44,
    alignItems: 'flex-end',
  },
  headerAddText: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFFFFF',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  // Net Worth: centered at top, large text
  netWorthSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  netWorthLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  netWorthValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  // Spacing between Net Worth and asset structure
  spacer: {
    height: 24,
  },
  assetStructureSection: {
    flex: 1,
  },
  groupsContainer: {
    gap: 20,
  },
  // Category card: dark surface, rounded, padded
  categoryCard: {
    backgroundColor: '#15161A',
    borderRadius: 16,
    padding: 20,
  },
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
    color: '#9CA3AF',
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E5E7EB',
  },
  divider: {
    height: 1,
    backgroundColor: '#23242A',
    marginVertical: 4,
  },
  typeSection: {
    marginLeft: 16,
    gap: 10,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  typeArrow: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
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
    color: '#9CA3AF',
  },
});
