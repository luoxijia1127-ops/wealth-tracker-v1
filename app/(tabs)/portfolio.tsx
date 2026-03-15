/**
 * PORTFOLIO SCREEN
 *
 * Loads assets from AsyncStorage under the key "assets" and displays them in a
 * FlatList. Each asset is shown as a simple card with: Asset Name, Category,
 * Type, and Total Value. If the asset has shares and price (e.g. investments),
 * total is calculated as shares * price; otherwise the stored value is used.
 *
 * Comments below explain each part for beginner developers.
 */

import type { SimpleAsset } from './add-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Key used when reading the assets array. Must match the key used when saving
// in the Add screen (ASSETS_STORAGE_KEY = "assets").
const ASSETS_STORAGE_KEY = 'assets';

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
 * Returns the total value to display for an asset.
 * If shares and price exist (and are both > 0), total = shares * price.
 * Otherwise we use the stored value (e.g. for Cash or when value was set directly).
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
 * Renders a single asset as a simple card with: Asset Name, Category, Type, Total Value.
 */
function AssetCard({ item }: { item: SimpleAsset }) {
  const totalValue = getTotalValue(item);

  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{item.name}</Text>
      <Text style={styles.cardMeta}>
        {item.category} · {item.type}
      </Text>
      <Text style={styles.cardValue}>{formatCurrency(totalValue)}</Text>
    </View>
  );
}

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<SimpleAsset[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Loads the assets array from AsyncStorage. getItem returns null if the key
   * has never been set, so we default to an empty array and catch parse errors.
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

  // Reload assets whenever this screen comes into focus (e.g. switching to
  // the Portfolio tab or returning after adding an asset on the Add screen).
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssets();
    }, [loadAssets])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#34C759" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Portfolio</Text>
        <Text style={styles.subtitle}>
          {assets.length === 0
            ? 'No assets yet. Add one from the Add tab.'
            : `${assets.length} asset${assets.length === 1 ? '' : 's'}`}
        </Text>
      </View>

      {/* FlatList renders only visible items (plus a few off-screen) for performance.
          data = the assets array; renderItem = render one AssetCard per item;
          keyExtractor = unique key for each item (required for list updates). */}
      <FlatList
        data={assets}
        renderItem={({ item }) => <AssetCard item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No assets</Text>
          </View>
        }
      />
    </View>
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
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingTop: 8,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardMeta: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#34C759',
  },
  emptyCard: {
    backgroundColor: '#1C1C1E',
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
